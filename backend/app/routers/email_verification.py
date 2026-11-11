"""
Email verification at sign-up.

    1. POST /signup or /register   creates an unverified account and emails a
                                    six-digit code -> {verification_required, email}
    2. POST /verify-email           {email, code} -> logged in: {access_token, user}
       POST /verify-email/resend    {email} -> {sent: true}

Until the code is entered, /login refuses the account with a 403 whose
X-Error-Code header is "email_not_verified", so the app and website can send
the user to the code screen.

Switch it off with REQUIRE_EMAIL_VERIFICATION=false — sign-up then logs the
user straight in, as it did before.

Codes follow the same rules as password reset codes: six digits, stored only
as a keyed hash, valid for CODE_LIFETIME, MAX_ATTEMPTS guesses, and no more
than one new code per RESEND_COOLDOWN.
"""

import hashlib
import hmac
import os
import secrets
from datetime import timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .. import auth, mailer, models, schemas
from ..database import get_db

router = APIRouter(prefix="/verify-email", tags=["email verification"])

CODE_LIFETIME = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5


def verification_required() -> bool:
    return os.getenv("REQUIRE_EMAIL_VERIFICATION", "true").strip().lower() not in ("0", "false", "no")


def _hash(user_id: int, code: str) -> str:
    message = f"verify:{user_id}:{code}".encode()
    return hmac.new(auth.SECRET_KEY.encode(), message, hashlib.sha256).hexdigest()


def _aware(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=models.utcnow().tzinfo)


def send_code(db: Session, user: models.User, background: BackgroundTasks, force: bool = False) -> bool:
    """
    Creates a fresh code for the user and emails it in the background.

    Returns False without sending if a code went out within the cooldown,
    unless `force` (used right after sign-up, when there can't be one).
    """
    now = models.utcnow()
    record = (
        db.query(models.EmailVerificationCode)
        .filter(models.EmailVerificationCode.user_id == user.id)
        .first()
    )
    if record and not force and _aware(record.created_at) > now - RESEND_COOLDOWN:
        return False

    code = f"{secrets.randbelow(1_000_000):06d}"
    if record is None:
        record = models.EmailVerificationCode(user_id=user.id)
        db.add(record)
    record.code_hash = _hash(user.id, code)
    record.attempts = 0
    record.created_at = now
    record.expires_at = now + CODE_LIFETIME
    db.commit()

    minutes = int(CODE_LIFETIME.total_seconds() // 60)
    background.add_task(
        mailer.send_email,
        user.email,
        "Verify your Knowtrients account",
        f"Hi {user.first_name},\n\n"
        f"Welcome to Knowtrients! Your verification code is {code}.\n\n"
        f"Enter it in the app or on the website to finish creating your "
        f"account. It expires in {minutes} minutes.\n\n"
        f"If you didn't sign up for Knowtrients, you can ignore this email.\n\n"
        f"— Knowtrients",
    )
    return True


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str


class ResendRequest(BaseModel):
    email: EmailStr


@router.post("", response_model=schemas.TokenResponse)
def verify_email(payload: VerifyRequest, db: Session = Depends(get_db)):
    """Confirms the email with the code, and logs the user in."""
    code = payload.code.strip()
    if not (len(code) == 6 and code.isdigit()):
        raise HTTPException(status_code=422, detail="Enter the 6-digit code from your email.")

    email = payload.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(status_code=404, detail="No account found with that email.")

    from .auth_routes import _user_response

    def logged_in():
        token = auth.create_access_token(data={"sub": str(user.id)})
        return schemas.TokenResponse(access_token=token, user=_user_response(user))

    if user.is_email_verified:
        raise HTTPException(status_code=409, detail="This email is already verified. Please log in.")

    record = (
        db.query(models.EmailVerificationCode)
        .filter(models.EmailVerificationCode.user_id == user.id)
        .first()
    )
    if record is None or _aware(record.expires_at) < models.utcnow():
        raise HTTPException(status_code=400, detail="That code has expired. Request a new one.")

    if not hmac.compare_digest(record.code_hash, _hash(user.id, code)):
        record.attempts += 1
        if record.attempts >= MAX_ATTEMPTS:
            db.delete(record)
            db.commit()
            raise HTTPException(status_code=400, detail="Too many incorrect attempts. Request a new code.")
        db.commit()
        left = MAX_ATTEMPTS - record.attempts
        raise HTTPException(
            status_code=400,
            detail=f"That code is incorrect. {left} attempt{'s' if left != 1 else ''} left.",
        )

    user.email_verified = True
    db.delete(record)
    db.commit()
    db.refresh(user)
    return logged_in()


@router.post("/resend")
def resend_code(payload: ResendRequest, background: BackgroundTasks, db: Session = Depends(get_db)):
    """Emails a new code to an account that hasn't been verified yet."""
    email = payload.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(status_code=404, detail="No account found with that email.")
    if user.is_email_verified:
        raise HTTPException(status_code=409, detail="This email is already verified. Please log in.")
    if not send_code(db, user, background):
        raise HTTPException(
            status_code=429,
            detail="A code was just sent. Please wait a minute before asking for another.",
        )
    return {"sent": True}
