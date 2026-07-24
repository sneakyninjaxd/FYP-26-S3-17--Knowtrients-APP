from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from . import models, schemas, auth
from .database import engine, get_db

# Creates tables if they don't exist yet (use Alembic migrations for real schema changes)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Knowtrients API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


@app.post("/signup", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
def create_account(payload: schemas.CreateAccountRequest, db: Session = Depends(get_db)):
    """Handles the 'Create Account' screen."""
    existing_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    new_user = models.User(
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        hashed_password=auth.hash_password(payload.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = auth.create_access_token(data={"sub": str(new_user.id)})
    return schemas.TokenResponse(access_token=token, user=new_user)


@app.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Handles the 'Login' screen."""
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = auth.create_access_token(data={"sub": str(user.id)})
    return schemas.TokenResponse(access_token=token, user=user)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    """Dependency to protect routes that need a logged-in user (e.g. the Home Dashboard)."""
    payload = auth.decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@app.get("/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    """Example protected route the app can call after login to load the dashboard."""
    return current_user
