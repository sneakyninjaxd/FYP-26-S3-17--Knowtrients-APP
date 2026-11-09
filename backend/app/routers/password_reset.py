"""
Password reset, in three steps matching the website's three pages:

    1. POST /password-reset/request   {email, role?}       -> {sent: true}
    2. POST /password-reset/verify    {email, code, role?} -> {token, email}
    3. POST /password-reset/complete  {token, new_password} -> {reset: true}

Safeguards:

- Step 1 always answers "sent", whether or not the email has an account, so
  the page can't be used to discover who is registered. The email goes out
  in the background, so response time doesn't give it away either.
- Codes are six digits, stored only as a keyed hash, expire after
  CODE_LIFETIME, allow MAX_ATTEMPTS guesses, and can't be re-requested more
  often than RESEND_COOLDOWN.
- A wrong code and an expired one get the same message, for the same reason.
- `role` is sent by the administrator pages, which pick an admin type. A code
  is only sent if the account matches, so a code can't be used against an
  account of the other type.
- The reset token is signed with a different key from login tokens, so it can
  never be used to sign in.
- PASSWORD_RESET_ANY_CODE switches on a demo mode that accepts any six
  digits. Off by default; see the warning beside it below. It also carries a fingerprint of the current
  password, so once the password changes, the token stops working — it can't
  be used twice.
"""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .. import auth, mailer, models
from ..database import get_db

router = APIRouter(prefix="/password-reset", tags=["password reset"])

CODE_LIFETIME = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5
TOKEN_LIFETIME = timedelta(minutes=15)

# Distinct from the login-token key, so a reset token is never accepted as a
# login token, and vice versa.
_RESET_KEY = f"{auth.SECRET_KEY}:password-reset"

# DEMO SWITCH. When PASSWORD_RESET_ANY_CODE is "true", step 2 accepts any six
# digits for an existing account, so the flow can be shown without setting up
# email. This lets anyone who knows an email address reset that account's
# password — including administrator accounts — so it is off unless
# deliberately switched on, and should never be on for real users.
ANY_CODE = os.getenv("PASSWORD_RESET_ANY_CODE", "").strip().lower() in ("1", "true", "yes")

if ANY_CODE:
    print(
        "WARNING: PASSWORD_RESET_ANY_CODE is on — password reset accepts any "
        "6-digit code. Anyone who knows an email address can reset that "
        "account's password. Turn it off before real users sign up."
    )


def _hash_code(user_id: int, code: str) -> str:
    message = f"{user_id}:{code}".encode()
    return hmac.new(auth.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def _password_fingerprint(user: models.User) -> str:
    return hashlib.sha256(user.hashed_password.encode()).hexdigest()[:16]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=models.utcnow().tzinfo)


def _role_matches(user: models.User, role: str | None) -> bool:
    return role is None or user.role == models.normalize_role(role)


class ResetRequest(BaseModel):
    email: EmailStr
    role: str | None = None


class ResetVerify(BaseModel):
    email: EmailStr
    code: str
    role: str | None = None


class ResetComplete(BaseModel):
    token: str
    new_password: str


@router.post("/request")
def request_reset(
    payload: ResetRequest,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Emails a six-digit code, if the email belongs to an active account."""
    email = payload.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email).first()

    # In demo mode no code is needed, so nothing is created or emailed.
    if not ANY_CODE and user and user.is_active and _role_matches(user, payload.role):
        now = models.utcnow()
        existing = (
            db.query(models.PasswordResetCode)
            .filter(models.PasswordResetCode.user_id == user.id)
            .first()
        )
        recently_sent = existing and _aware(existing.created_at) > now - RESEND_COOLDOWN
        if not recently_sent:
            code = f"{secrets.randbelow(1_000_000):06d}"
            if existing is None:
                existing = models.PasswordResetCode(user_id=user.id)
                db.add(existing)
            existing.code_hash = _hash_code(user.id, code)
            existing.attempts = 0
            existing.created_at = now
            existing.expires_at = now + CODE_LIFETIME
            db.commit()

            minutes = int(CODE_LIFETIME.total_seconds() // 60)
            background.add_task(
                mailer.send_email,
                user.email,
                "Your Knowtrients password reset code",
                f"Hi {user.first_name},\n\n"
                f"Your password reset code is {code}.\n\n"
                f"It expires in {minutes} minutes. If you didn't ask to reset "
                f"your password, you can ignore this email — your password "
                f"won't change.\n\n— Knowtrients",
            )

    return {"sent": True}


@router.post("/verify")
def verify_code(payload: ResetVerify, db: Session = Depends(get_db)):
    """Checks the code and, if right, returns a short-lived reset token."""
    code = payload.code.strip()
    if not (len(code) == 6 and code.isdigit()):
        raise HTTPException(status_code=422, detail="Enter the 6-digit code from your email.")

    wrong = HTTPException(
        status_code=400,
        detail="That code is incorrect or has expired. Please check it or request a new one.",
    )

    email = payload.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise wrong

    if ANY_CODE:
        # Demo mode: any six digits pass. The account must still exist, be
        # active, and match the admin type chosen on the page.
        if not user.is_active:
            raise wrong
        if not _role_matches(user, payload.role):
            label = models.ROLE_LABELS.get(models.normalize_role(payload.role), payload.role)
            article = "an" if label[:1].upper() in "AEIOU" else "a"
            raise HTTPException(status_code=403, detail=f"This email is not {article} {label} account.")
        return _issue_token(user)

    record = (
        db.query(models.PasswordResetCode)
        .filter(models.PasswordResetCode.user_id == user.id)
        .first()
    )
    if record is None or _aware(record.expires_at) < models.utcnow():
        raise wrong

    if not hmac.compare_digest(record.code_hash, _hash_code(user.id, code)):
        record.attempts += 1
        if record.attempts >= MAX_ATTEMPTS:
            db.delete(record)
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Too many incorrect attempts. Please request a new code.",
            )
        db.commit()
        raise wrong

    # Checked only once the code is right, so this can't be used to probe
    # which type an email address belongs to.
    if not _role_matches(user, payload.role):
        label = models.ROLE_LABELS.get(models.normalize_role(payload.role), payload.role)
        article = "an" if label[:1].upper() in "AEIOU" else "a"
        raise HTTPException(status_code=403, detail=f"This email is not {article} {label} account.")

    # The code is spent; from here the token carries the authority.
    db.delete(record)
    db.commit()
    return _issue_token(user)


def _issue_token(user: models.User) -> dict:
    """A short-lived reset token, signed with the reset key."""
    token = jwt.encode(
        {
            "sub": str(user.id),
            "purpose": "password_reset",
            "fp": _password_fingerprint(user),
            "exp": datetime.utcnow() + TOKEN_LIFETIME,
        },
        _RESET_KEY,
        algorithm=auth.ALGORITHM,
    )
    return {"token": token, "email": user.email}


@router.post("/complete")
def complete_reset(payload: ResetComplete, db: Session = Depends(get_db)):
    """Sets the new password, given a valid reset token."""
    expired = HTTPException(status_code=400, detail="This reset link has expired. Please start again.")

    try:
        data = jwt.decode(payload.token, _RESET_KEY, algorithms=[auth.ALGORITHM])
    except JWTError:
        raise expired
    if data.get("purpose") != "password_reset":
        raise expired

    user = db.query(models.User).filter(models.User.id == int(data.get("sub", 0))).first()
    if user is None or data.get("fp") != _password_fingerprint(user):
        raise expired

    if len(payload.new_password or "") < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    user.hashed_password = auth.hash_password(payload.new_password)
    db.commit()
    return {"reset": True}
