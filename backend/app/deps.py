"""Shared FastAPI dependencies, kept out of main.py so routers can import them
without a circular import."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from . import auth, models
from .database import get_db

# Points at /token rather than /login: Swagger's Authorize dialog posts
# form-encoded credentials, which the JSON-bodied /login cannot accept.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    """Resolves the bearer token to a User, rejecting suspended accounts."""
    payload = auth.decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been suspended")
    return user


def get_current_admin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """Restricts a route to administrator accounts."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return current_user
