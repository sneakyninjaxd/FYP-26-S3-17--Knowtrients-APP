"""Knowtrients API entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine
from .routers import (
    admin,
    auth_routes,
    fitness,
    logs,
    platform,
    profile,
    recommendation,
    satisfaction,
    subscription,
    support,
)

# Creates tables if they don't exist. Adequate for the project; a schema change
# to an existing table still needs a migration (Alembic) since create_all only
# ever adds, never alters.
models.Base.metadata.create_all(bind=engine)

# create_all never alters an existing table, so new nullable columns on old
# tables are added here. Additive only — see app/schema_upgrades.py.
from .schema_upgrades import ensure_columns  # noqa: E402

_added = ensure_columns(engine)
if _added:
    print(f"Schema upgrade: added {', '.join(_added)}")


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

    # Loaded independently, so a missing fitness model doesn't take the diet
    # recommendations down with it (or the reverse).
    try:
        from .ml import fitness_recommender

        fitness_recommender._load()
        print("Fitness model artefacts loaded.")
    except FileNotFoundError:
        print("Fitness model not found — fitness endpoints will return 503.")
    except Exception as exc:  # noqa: BLE001
        print(f"Fitness model failed to load: {exc}")

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
# The fitness router is registered before the general recommendation router
# so its /recommendation/fitness/* paths are matched first.
app.include_router(fitness.router)
app.include_router(recommendation.router)
app.include_router(admin.router)
app.include_router(support.user_router)
app.include_router(support.admin_router)
app.include_router(platform.router)
app.include_router(subscription.router)
app.include_router(satisfaction.router)


@app.get("/health", tags=["meta"])
def health():
    """Cheap endpoint for uptime checks and for waking a suspended instance."""
    return {"status": "ok"}
