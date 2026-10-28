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

**USDA FoodData Central** — the real data. Get a free key at
<https://fdc.nal.usda.gov/api-key-signup/>, add `USDA_API_KEY=...` to `.env`,
then:

```bash
python ml/import_usda.py --terms-file ml/usda_terms.txt --dry-run
python ml/import_usda.py --terms-file ml/usda_terms.txt
python ml/remove_placeholders.py
```

Three datasets are imported: Foundation and SR Legacy for individual foods,
and Survey (FNDDS) for prepared dishes like fried rice and curries. Branded
is left out so commercial products don't swamp ordinary searches.

Search results don't carry serving sizes, so the importer fetches full
details in batches of 20 and stores each food's first real portion. Foods
without one default to 100 g when logged.

`ml/usda_terms.txt` uses American names — "shrimp", "ground beef",
"whole-wheat" — because that's what USDA's search matches.

**Loading the live database.** Pass the external URL instead of editing
`.env`; it applies to that run only:

```bash
python ml/import_usda.py --terms-file ml/usda_terms.txt --database-url "postgresql://..."
python ml/remove_placeholders.py --database-url "postgresql://..."
```

`create_admin.py` takes the same option. `remove_placeholders.py` refuses to
run until real data exists, so food search is never left empty.

### Food search

Every word of the query must appear in the name, in any order, so "chicken
breast" finds "Chicken, broilers or fryers, breast, roasted". Plurals and
common local names are handled — "prawns" finds shrimp, "brinjal" eggplant,
"bee hoon" rice noodles. The plain food ranks first: "banana" gives "Bananas,
raw" before "Banana bread". Synonyms are in `app/food_search.py`.

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

**Support requests** have two types, stored in the `support_type` column
(`account` or `bug`) and decided by category:

| Account | Bug |
|---|---|
| password, account, subscription, account_other | bug_logging, bug_insights, bug_profile, bug_account, bug_other |

Hyphenated ids (`account-others`, `bug-other`) are normalised, so the app's
existing form works unchanged. The older categories (`password_change`,
`account_recovery`, `bug_report`, `other`) are still accepted.

`support_type` is set by the server from the category and never accepted from
the client, so the two can't disagree. It's indexed, so filtering by type is
fast, and it's visible directly in the database:

```sql
SELECT support_type, COUNT(*) FROM support_requests GROUP BY support_type;
```

Requests created before the column existed are filled in automatically at
start-up.

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


## Sleep recommendation model

The third model, alongside diet and fitness. Same approach — XGBoost with
exact SHAP attributions — over a seven-night window.

**Train it:**

```bash
python ml/train_sleep_model.py
```

**Endpoint:** `GET /recommendation/sleep/today?log_date=YYYY-MM-DD`

### Inputs

| Feature | From |
|---|---|
| avg_sleep_hours | Sleep logs, logged nights only |
| short_nights | Nights under 6 hours |
| duration_variability | Standard deviation of sleep length |
| bedtime_variability | Standard deviation of bedtime, in minutes |
| wake_variability | Standard deviation of wake time, in minutes |
| avg_bedtime | Minutes relative to midnight (23:30 = −30, 00:45 = +45) |
| satisfaction_rate | Share of nights rated satisfying, from sleep check-ins |
| weekly_activity_minutes | Activity logs, moderate-equivalent |
| age | Profile |

The app sends a bedtime and wake time with every entry, so timing is
reliable. It doesn't ask for sleep quality, so the `quality` column isn't
used; subjective quality comes from satisfaction ratings instead.

Bedtimes are measured relative to midnight so they average correctly:
23:30, 00:30 and 01:00 average to 12:20 am. Plain clock minutes would put
the average near midday.

### Recommendations

In priority order:

1. **Aim for 7–9 hours a night** — average outside 7–9 hours, in either
   direction. Long sleep is flagged as well as short.
2. **Keep a more regular sleep schedule** — bed or wake time varying by more
   than an hour, or sleep length by more than 1.5 hours.
3. **Improve how restful your sleep is** — duration and timing fine, but
   fewer than half the week's nights rated satisfying.
4. **Sleep is on track.**

The one-hour regularity threshold is a working value. Research links
irregular timing to worse outcomes, but there's no agreed clinical cut-off.

Advice about long or unrestful sleep suggests speaking to a doctor if it
persists, rather than implying the app can resolve it (C-07).

### Missing data

- A night with no entry is missing, not zero sleep.
- Spread needs at least two nights; with fewer, a typical value is assumed.
- With no sleep ratings that week, satisfaction is assumed typical, and the
  explanation says the user hasn't rated their sleep.

### Known limitation

The bedtime calculation assumes a conventional night-time sleeper. Someone
on night shifts who sleeps from 08:00 would be read as going to bed very
late. Shift work isn't recorded, so the model can't tell the difference.

### Accuracy

About 94.5% against the guideline-based labels on held-out synthetic data,
with recall of 0.76 or better on every recommendation. As with the other
models, this shows the pipeline works, not real-world effectiveness.


## Roles (renamed)

| Slug | Label | Owns |
|---|---|---|
| `account_administrator` | Account Administrator | Everything under `/admin`: accounts, staff creation, account support requests |
| `platform_administrator` | Platform Administrator | `/im` and `/platform`: analytics, model quality, bug reports, the nutrition catalogue |

These replaced `user_admin` and `platform_manager`. Existing accounts are
renamed automatically at start-up, and the old names are still accepted
anywhere a role is sent — `create_admin.py`, role changes and filters.

## Website endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/register` | Public sign-up. Always creates an app user — the role is never read from the request |
| POST | `/admin/accounts` | Account Administrator creates a staff account |
| PATCH | `/me` | Change own name |
| POST | `/me/password` | Change own password; needs the current one |
| GET | `/im/analytics` | Figures and chart data for the PA pages |
| GET | `/im/feedback` | Bug report queue |
| GET | `/im/feedback/{id}` | One bug report |
| POST | `/im/feedback/{id}/reply` | Reply, optionally resolving |
| PATCH | `/im/feedback/{id}/status` | Resolve or reopen |

The `/im/` prefix dates from when this role was called IT manager.

**"AI accuracy" means user-rated helpfulness.** There's no ground truth for
whether a recommendation was correct, so each chart point is the share of
that day's rated recommendations marked helpful. Days without ratings are
`null`, not zero.

**Request metrics.** Middleware times every request and counts 5xx errors,
saving daily totals to `request_stats` once a minute rather than writing on
every request. It reports a request success rate rather than uptime, since a
server can't record its own downtime.

**SQLite now enforces foreign keys**, so deleting an account removes its data
locally the same way it does on PostgreSQL.

## Missing data never drives a recommendation

When there isn't enough data to measure a feature — sleep regularity from a
single night, sleep in the fitness model when none was logged — the gap is
filled with a value safely inside the guideline, not the typical value from
training. The typical values sat on the wrong side of their thresholds
(bedtime spread 67 minutes against a 60-minute limit; sleep 6.9 hours against
7), so filling gaps with them made both models recommend fixing problems the
user's data didn't show. Assumed values are also never presented as the
reason for advice.

## Roles (earlier notes)

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
