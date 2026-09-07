"""Account creation, login, and the current-user endpoint."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(tags=["auth"])


def _user_response(user: models.User) -> schemas.UserResponse:
    """Includes onboarding state so the client knows whether to route the user
    into the profile flow or straight to the dashboard."""
    return schemas.UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        onboarding_complete=bool(user.profile and user.profile.onboarding_complete),
    )


@router.post("/signup", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
def create_account(payload: schemas.CreateAccountRequest, db: Session = Depends(get_db)):
    """Handles the Create Account screen."""
    email = payload.email.lower().strip()

    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    new_user = models.User(
        email=email,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        hashed_password=auth.hash_password(payload.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = auth.create_access_token(data={"sub": str(new_user.id)})
    return schemas.TokenResponse(access_token=token, user=_user_response(new_user))


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Handles the Login screen."""
    user = (
        db.query(models.User)
        .filter(models.User.email == payload.email.lower().strip())
        .first()
    )
    # Same message for both failure modes, so the endpoint can't be used to
    # discover which email addresses have accounts.
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been suspended")

    token = auth.create_access_token(data={"sub": str(user.id)})
    return schemas.TokenResponse(access_token=token, user=_user_response(user))


@router.post("/token", response_model=schemas.TokenResponse, include_in_schema=False)
def token_login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """
    Form-encoded login, used only by the Authorize button in /docs.

    Swagger's OAuth2 password flow posts `username` and `password` as form
    fields, which the JSON-bodied /login endpoint cannot accept. This endpoint
    exists so the interactive documentation is usable for testing and
    demonstration; the mobile client uses /login.

    The `username` field carries the email address.
    """
    user = (
        db.query(models.User)
        .filter(models.User.email == form_data.username.lower().strip())
        .first()
    )
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been suspended")

    token = auth.create_access_token(data={"sub": str(user.id)})
    return schemas.TokenResponse(access_token=token, user=_user_response(user))


@router.get("/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return _user_response(current_user)
