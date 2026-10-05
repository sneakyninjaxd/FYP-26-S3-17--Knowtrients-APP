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


## Nutrition catalogue

The `foods` table is populated by import scripts, not by calling an external
API at request time. Food searches in the app query this local table, so a
user logging a meal does not depend on a third-party service being available.

**Starter data** (24 placeholder entries, for development):

```bash
python ml/seed_foods.py
```

**USDA FoodData Central.** Get a free key at
<https://fdc.nal.usda.gov/api-key-signup/>, add `USDA_API_KEY=...` to `.env`,
then:

```bash
python ml/import_usda.py --terms-file ml/usda_terms.txt --dry-run
python ml/import_usda.py --terms-file ml/usda_terms.txt --limit 3
```

Run the dry run first — it prints what would be imported without writing
anything, which is the cheapest way to catch a nutrient that is coming back
as zero.

Only Foundation and SR Legacy foods are imported; the Branded dataset would
swamp search results with commercial products. Entries are marked
`source="USDA FoodData Central"` with the FDC id in `source_ref`, so every
value remains traceable (constraint C-06). Re-running is safe — entries
already present are skipped.

Edit `ml/usda_terms.txt` to change what gets imported. Specific terms work
better than general ones: "chicken breast roasted" beats "chicken".

## Roles

Responsibility is divided by subject matter, not seniority. Neither role
outranks the other.

**User Admin** — anything to do with accounts:
- View, search and filter accounts
- Suspend and reactivate, including other staff accounts
- Change roles
- Delete accounts
- Handle the support request queue

**Platform Manager** — anything to do with system performance:
- Nutrition catalogue: add, correct and remove foods
- Platform metrics: recommendation volume, confidence distribution, logging rates
- Fairness report: recommendation mix and confidence across age and BMI groups

Both roles can read the catalogue, since a User Admin answering a support
request about a wrong nutrition value needs to look it up.

Neither can suspend or delete their own account, and a User Admin cannot
remove their own role — each would leave the system with no way to recover
short of database access.
