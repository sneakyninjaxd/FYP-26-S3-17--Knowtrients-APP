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


## Fitness recommendation model

A second model, alongside the diet one, that recommends from a week of
activity, sleep and step data. Same approach: XGBoost explained with SHAP
TreeExplainer, so attributions are exact (constraint C-01).

**Train it** (artefacts are committed, so this is only needed after changes):

```bash
python ml/train_fitness_model.py
```

**Endpoint:** `GET /recommendation/fitness/today?log_date=YYYY-MM-DD`

### Why a week, not a day

The diet model judges a single day. Fitness can't: the WHO guidelines are
weekly, and one rest day isn't a problem. Judging a day would tell someone
who trained hard yesterday that they're sedentary today.

### Inputs

| Feature | From |
|---|---|
| weekly_mvpa_minutes | Activity logs: moderate minutes + 2 × vigorous (WHO equivalence) |
| weekly_vigorous_minutes | Activity logs marked Intense |
| active_days | Days with any activity, or 7,500+ synced steps |
| strength_sessions | Activities of type Strength Training |
| avg_daily_steps | Steps synced from Health Connect |
| avg_sleep_hours | Sleep logs |
| sleep_variability | Standard deviation of logged sleep |
| age, bmi | Profile |

"Easy" activity doesn't count towards the 150 minutes — WHO counts only
moderate and vigorous — but it does count as an active day.

### Recommendations

Labels come from published guidance, applied in priority order:

1. **Prioritise rest and recovery** — 150+ vigorous minutes on under 6.5h
   sleep. Ranked first because it's the one pattern carrying injury risk.
2. **Build up your weekly activity** — under 150 moderate-equivalent minutes
   (WHO 2020).
3. **Improve your sleep** — under 7 hours, or more than 1.5 hours of
   night-to-night variation.
4. **Add muscle-strengthening sessions** — fewer than 2 a week (WHO 2020).
5. **On track — keep it up.**

The 1.5-hour variability threshold is a working value, not a clinical
guideline — sleep regularity has no agreed cut-off.

### Missing data

- A day with no activity counts as zero activity. Rest days are real.
- A night with no sleep entry is **missing**, not zero sleep — reading it as
  zero would tell anyone who forgot to log that they need more sleep.
- With no synced steps, a typical value is assumed and the explanation says
  so.

An entirely empty week returns 409 rather than a recommendation.

### Data completeness vs confidence

`confidence` is the model's probability for its answer. `data_completeness`
is the share of the week that was logged. They're reported separately on
purpose: the model can be very confident about a week with one logged walk.

### Explanations

Two differences from the diet model's explanations:

- **Only factors that supported the result are described.** A factor is
  either a *direct driver* — low activity supports "build up your
  activity" — or supports it *by elimination*: good sleep rules out "improve
  your sleep", making other recommendations likelier. Each is worded
  accordingly, so good sleep isn't presented as a reason to exercise more.
- **Age and BMI are never described as reasons.** They stay model inputs
  and appear in `factors`, but nobody can act on their age, and where the
  model learned an indirect correlation through them the sentence read as
  nonsense.

### Accuracy

Test accuracy is about 94%, measured against the guideline-based labels on
held-out synthetic data. It shows the pipeline works; it isn't evidence of
real-world effectiveness.

The first version scored 95.5% overall but caught only 25% of recovery
cases — the one recommendation carrying injury risk — because they were rare
in the data and buried by label noise. Adding a high-training subpopulation,
restricting noise to genuinely ambiguous weeks, and weighting classes by
frequency raised recovery recall to 78%. Overall accuracy fell slightly; the
model is now good at all five recommendations rather than good at the common
ones.

## New tables

All additions are new tables. None adds a column to an existing table,
because `create_all` creates missing tables but never alters existing ones.
A deploy picks these up automatically — **no database reset needed**.

| Table | Purpose |
|---|---|
| `subscriptions` | User plan. No row means free. No payment data stored (C-09) |
| `recommendation_feedback` | Thumbs up/down with reason, for diet and fitness |
| `device_daily_metrics` | Steps and active calories synced from Health Connect |
| `fitness_recommendation_history` | Fitness recommendations with inputs and SHAP values |

## New endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/recommendation/fitness/today` | Fitness recommendation for the past week |
| GET | `/recommendation/fitness/history` | Past fitness recommendations |
| POST | `/recommendation/feedback` | Rate a recommendation (by `history_id`) |
| DELETE | `/recommendation/feedback` | Withdraw a rating |
| GET | `/recommendation/feedback` | The user's own ratings |
| PUT | `/logs/steps` | Sync steps from Health Connect |
| GET | `/logs/steps` | Synced steps for recent days |
| GET | `/logs/activity/range` | Daily activity totals across a range, in one call |
| DELETE | `/logs/sleep/{id}` | Delete a sleep entry |
| GET | `/subscription` | Current plan |
| POST | `/subscription/upgrade` | Simulated upgrade to Premium |
| POST | `/subscription/cancel` | Return to free |
| GET | `/platform/feedback` | Platform Manager: review flagged explanations |
| GET | `/platform/feedback/summary` | Platform Manager: helpfulness by recommendation |

`GET /profile` now also returns `plan`, and recommendation responses include
`history_id` for feedback.


## Schema upgrades

`create_all` creates missing tables but never alters existing ones, so adding
a column used to mean wiping the database. `app/schema_upgrades.py` closes
that gap for the one change that is always safe: **adding a nullable column**.

On start-up it adds any column listed in `ADDITIVE_COLUMNS` that the database
doesn't have yet. It only ever adds — never drops, renames or retypes — so it
can't lose data. Running it repeatedly is safe.

To add a column:

1. Add it to the model as `nullable=True`
2. Add an entry to `ADDITIVE_COLUMNS`
3. Deploy

Anything more involved — renames, type changes, non-nullable columns — still
needs a proper migration tool such as Alembic.

## Support, chat and satisfaction

**Support requests** have two types, decided by category:

| Account | Bug |
|---|---|
| password, account, subscription, account_other | bug_logging, bug_insights, bug_profile, bug_account, bug_other |

Hyphenated ids (`account-others`, `bug-other`) are normalised, so the app's
existing form works unchanged. The older categories (`password_change`,
`account_recovery`, `bug_report`, `other`) are still accepted.

For an "other" category, `other_detail` becomes the subject. `is_persisting`
records whether a bug is still happening.

**Chat** — each request carries a conversation in `support_messages`. Opening
a thread marks the other side's messages as read. A user replying to a
resolved request reopens it. Requests from before chat existed are converted
into threads the first time they're opened.

**Satisfaction** — satisfied or not, for sleep, activity or food, per day or
per entry. Re-rating replaces.

| Method | Path | Purpose |
|---|---|---|
| GET | `/support/requests/{id}/messages` | User: a request's conversation |
| POST | `/support/requests/{id}/messages` | User: send a message |
| GET | `/support/unread` | User: unread staff replies, for a badge |
| GET | `/admin/requests/{id}/messages` | Staff: a request's conversation |
| POST | `/admin/requests/{id}/messages` | Staff: message without resolving |
| PUT | `/logs/satisfaction` | Rate a day or an entry |
| GET | `/logs/satisfaction` | The user's ratings |
| GET | `/logs/satisfaction/summary` | The user's satisfaction rate per domain |
| DELETE | `/logs/satisfaction/{id}` | Withdraw a rating |
| GET | `/platform/satisfaction` | Platform Manager: rates across all users |

`GET /support/requests` and `GET /admin/requests` both accept `?type=account`
or `?type=bug`.

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
