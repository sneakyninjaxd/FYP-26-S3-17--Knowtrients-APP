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
    im,
    logs,
    platform,
    profile,
    recommendation,
    satisfaction,
    sleep_insight,
    subscription,
    support,
)

# Creates tables if they don't exist. Adequate for the project; a schema change
# to an existing table still needs a migration (Alembic) since create_all only
# ever adds, never alters.
models.Base.metadata.create_all(bind=engine)

# create_all never alters an existing table, so new nullable columns on old
# tables are added here. Additive only — see app/schema_upgrades.py.
from .schema_upgrades import (  # noqa: E402
    backfill_support_type,
    ensure_columns,
    ensure_indexes,
    migrate_role_names,
)

_added = ensure_columns(engine)
if _added:
    print(f"Schema upgrade: added {', '.join(_added)}")
ensure_indexes(engine)
_renamed = migrate_role_names(engine)
if _renamed:
    print(f"Schema upgrade: renamed the role on {_renamed} staff account(s)")
_filled = backfill_support_type(engine)
if _filled:
    print(f"Schema upgrade: set support_type on {_filled} existing request(s)")


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

    try:
        from .ml import sleep_recommender

        sleep_recommender._load()
        print("Sleep model artefacts loaded.")
    except FileNotFoundError:
        print("Sleep model not found — sleep endpoints will return 503.")
    except Exception as exc:  # noqa: BLE001
        print(f"Sleep model failed to load: {exc}")

    # Request counters are kept in memory and saved every minute.
    import asyncio

    from . import metrics

    flusher = asyncio.create_task(metrics.flush_periodically())

    yield

    # Save whatever has accumulated since the last flush before stopping.
    flusher.cancel()
    metrics.flush()


app = FastAPI(title="Knowtrients API", version="1.0.0", lifespan=lifespan)

# Times every request and counts server errors, for the Platform
# Administrator's performance figures. See app/metrics.py.
from . import metrics as _metrics  # noqa: E402

app.middleware("http")(_metrics.middleware)

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
app.include_router(sleep_insight.router)
app.include_router(recommendation.router)
app.include_router(admin.router)
app.include_router(support.user_router)
app.include_router(support.admin_router)
app.include_router(platform.router)
app.include_router(subscription.router)
app.include_router(satisfaction.router)
app.include_router(im.router)


@app.get("/health", tags=["meta"])
def health():
    """Cheap endpoint for uptime checks and for waking a suspended instance."""
    return {"status": "ok"}
