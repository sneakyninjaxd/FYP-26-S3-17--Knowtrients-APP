# Knowtrients Backend

FastAPI service backing the Knowtrients mobile app.

## Local setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET_KEY
python ml/train_model.py      # builds app/ml/artifacts/ (already committed)
python ml/seed_foods.py       # starter food catalogue
uvicorn app.main:app --reload
```

Interactive API docs at http://127.0.0.1:8000/docs

## Frontend `.env`

In the **project root** (not `backend/`):

```
EXPO_PUBLIC_API_URL=https://knowtrients-backend-database.onrender.com
```

No trailing slash. Restart with `npx expo start -c` — Expo inlines env vars at
bundle time, so a hot reload will not pick up changes.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Uptime check; also wakes a suspended instance |
| POST | `/signup` | Create account |
| POST | `/login` | Log in |
| GET | `/me` | Current user, incl. `onboarding_complete` |
| GET | `/profile` | Read profile |
| PUT | `/profile` | Partial upsert — each onboarding step saves independently |
| GET | `/foods/search?q=` | Food search |
| GET | `/foods/{id}` | Single food |
| POST | `/logs/food` | Log a food item |
| GET | `/logs/food?log_date=&meal_type=` | List entries |
| DELETE | `/logs/food/{id}` | Remove entry |
| PUT | `/logs/water` | Set day's water total |
| PUT | `/logs/sleep` | Record night's sleep |
| GET | `/logs/sleep?days=` | Recent sleep |
| POST | `/logs/activity` | Log activity |
| GET | `/logs/activity?log_date=` | List activities |
| DELETE | `/logs/activity/{id}` | Remove activity |
| GET | `/logs/summary?log_date=` | Dashboard: totals, per-meal rows, sleep, activity |
| GET | `/recommendation/today` | Recommendation from logged data |
| POST | `/recommendation` | Recommendation from supplied features (testing) |
| GET | `/recommendation/history?limit=` | Past recommendations |

All routes except `/health`, `/signup` and `/login` require
`Authorization: Bearer <token>`.

## Deployment (Render)

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env vars: `DATABASE_URL` (Postgres internal URL), `JWT_SECRET_KEY`

Model artefacts are committed and loaded at start-up (C-04); training does not
run on the deployment platform.
