"""Knowtrients API entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine
from .routers import auth_routes, logs, profile, recommendation

# Creates tables if they don't exist. Adequate for the project; a schema change
# to an existing table still needs a migration (Alembic) since create_all only
# ever adds, never alters.
models.Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Warms the model at start-up rather than on the first request.

    Loading the XGBoost model and the SHAP explainer takes a few seconds. On a
    suspended free-tier instance (C-05) that cost would otherwise land on
    whichever user happens to trigger the cold start.
    """
    try:
        from .ml import recommender

        recommender._load()
        print("Model artefacts loaded.")
    except FileNotFoundError:
        # The API still serves auth and logging without the model; the
        # recommendation routes return 503 until artefacts are present.
        print("Model artefacts not found — recommendation endpoints will return 503.")
    except Exception as exc:  # noqa: BLE001
        print(f"Model artefacts failed to load: {exc}")

    yield


app = FastAPI(title="Knowtrients API", version="1.0.0", lifespan=lifespan)

# Expo Go sends no browser origin from a native build, and the dev URL varies
# per machine. Left open for the project; tighten before any production use.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(profile.router)
app.include_router(logs.router)
app.include_router(recommendation.router)


@app.get("/health", tags=["meta"])
def health():
    """Cheap endpoint for uptime checks and for waking a suspended instance."""
    return {"status": "ok"}
