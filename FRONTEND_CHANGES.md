# Frontend changes for the new backend features

The backend now supports everything the app had marked as missing. Each
section below names the screen, what to change, and the `api.ts` addition.

Nothing here breaks existing code. Every new field is additive, so the app
keeps working unchanged until each piece is wired up.

---

## 1. Recommendation feedback — `insight.js`

**Read this one carefully, because it's easy to get wrong.**

The feedback TODO in `giveFeedback` uses `rec.recommendation_id`. That's the
wrong field. `recommendation_id` identifies the *kind* of advice (0–4), so
every user who got "Increase fibre" shares the same value. Feedback keyed on
it can't tell one recommendation from another.

Every recommendation response now includes **`history_id`**, which
identifies that specific recommendation. Use it instead.

```ts
// api.ts
submitFeedback: (token: string, data: {
  domain: 'diet' | 'fitness';
  recommendation_ref: number;   // the history_id
  rating: 'up' | 'down';
  reason?: string;
}) =>
  request('/recommendation/feedback', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  }),

withdrawFeedback: (token: string, domain: string, ref: number) =>
  request<void>(`/recommendation/feedback?domain=${domain}&recommendation_ref=${ref}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  }),

/** Restores thumbs state after a restart. */
myFeedback: (token: string) =>
  request<any[]>('/recommendation/feedback', { headers: authHeaders(token) }),
```

Then in `giveFeedback`, replace the commented-out block:

```js
await api.submitFeedback(token, {
  domain: 'diet',
  recommendation_ref: rec.history_id,   // not rec.recommendation_id
  rating: type,
  reason,
});
```

And in `clearFeedback`, call `api.withdrawFeedback(token, 'diet', rec.history_id)`.

A thumbs-down **without a reason is rejected** with a 400. The app already
asks for one before submitting, so this only matters if that flow changes.

Ratings now persist. Call `api.myFeedback()` on load to restore which
recommendations the user has already rated.

Platform Managers can review thumbs-down ratings at `GET /platform/feedback`
— this is the "Review Flagged Explanations" function.

---

## 2. Fitness recommendation — `insight.js`

Replaces the hardcoded Activity card. The comment above
`PLACEHOLDER_INSIGHTS` — "sleep and activity aren't inputs" — no longer
applies to activity.

```ts
// api.ts
getFitnessRecommendation: (token: string, logDate?: string) =>
  request<FitnessRecommendationResponse>(
    `/recommendation/fitness/today${logDate ? `?log_date=${logDate}` : ''}`,
    { headers: authHeaders(token) }
  ),
```

The response includes an **`insight`** object in exactly the shape of an
entry in `src/insights.js` — `aspect`, `confidence`, `observations`,
`title`, `summary`, `dataUsed`, `reasoningSimple`, `reasoningTechnical`,
`recommendation`, `footer`. So the existing card and modal render it with no
layout changes:

```js
const [fitness, setFitness] = useState(null);

// alongside the diet fetch
try {
  setFitness(await api.getFitnessRecommendation(token, toLogDate()));
} catch (err) {
  // 409 = profile incomplete or nothing logged this week — show the message
}

// then build the list from real data instead of the placeholder
const otherInsights = [
  ...(fitness ? [fitness.insight] : []),
  ...PLACEHOLDER_INSIGHTS.filter((i) => i.id === 'sleep'),
];
```

The Sleep card stays a placeholder for now — see the note at the end.

**Response fields worth knowing:**

| Field | Meaning |
|---|---|
| `history_id` | Use for feedback, with `domain: 'fitness'` |
| `confidence` | Model probability, 0–1 |
| `data_completeness` | Share of the week that was logged, 0–1 |
| `next_step` | A concrete action sized from the user's own numbers |
| `cached` | True when the week's data hasn't changed since last time |
| `insight.footer` | A caveat when under half the week was logged; empty otherwise |

**Show `data_completeness` somewhere.** It's deliberately separate from
`confidence`: the model can be very sure about a week that was barely logged.
`insight.footer` already carries a warning when completeness is low, so
rendering the footer is the minimum.

**409 responses** mean the profile is incomplete or nothing was logged in
the past seven days. Both carry a message written for display.

Opening the screen repeatedly is fine — the result is reused until the
user logs something new, so it won't fill history with duplicates.

---

## 3. Activity range — `activity-context.js`

`loadWeek` and `loadRange` currently call `/logs/activity` once per day —
seven requests for a week, ninety for the longest range. One call replaces
both:

```ts
// api.ts
getActivityRange: (token: string, days = 7, endDate?: string) =>
  request<{ date: string; minutes: number; calories: number; count: number; steps: number | null }[]>(
    `/logs/activity/range?days=${days}${endDate ? `&end_date=${endDate}` : ''}`,
    { headers: authHeaders(token) }
  ),
```

```js
const loadRange = useCallback(async (days = 7, endDate = toLogDate()) => {
  if (!token) return [];
  const rows = await api.getActivityRange(token, days, endDate);
  setWeekly((prev) => ({
    ...prev,
    ...Object.fromEntries(rows.map((r) => [r.date, r.minutes])),
  }));
  return rows;
}, [token]);
```

Every day in the range is returned, including empty ones, so the chart
needs no gap-filling. Rows also carry `steps` once they've been synced (see
section 4). Maximum range is 365 days.

---

## 4. Steps sync — `src/health.js`

Steps are currently read from Health Connect, shown, and thrown away. Sync
them so they persist and feed the fitness model:

```ts
// api.ts
syncSteps: (token: string, data: {
  steps?: number | null;
  active_calories?: number | null;
  log_date?: string;
}) =>
  request('/logs/steps', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  }),
```

Call it after a successful `readDay`:

```js
const today = await readDay(new Date());
if (today) {
  await api.syncSteps(token, {
    steps: today.steps,
    active_calories: today.calories,
    log_date: toLogDate(),
  });
}
```

Safe to call as often as you like. Health Connect reports a running daily
total, so each sync **replaces** the day's figure rather than adding to it.
Sending `null` for a field leaves the stored value alone.

Without synced steps, the fitness model assumes a typical value and says so
in its explanation. Syncing makes the recommendation more accurate.

---

## 5. Sleep delete — `sleep-context.js`

`deleteSleep` currently logs a warning because there was no endpoint.

```ts
// api.ts
deleteSleepLog: (token: string, logId: number) =>
  request<void>(`/logs/sleep/${logId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  }),
```

```js
const deleteSleep = async (logId) => {
  if (!token) return false;
  const previous = sleepLogs;
  setSleepLogs((prev) => prev.filter((s) => s.id !== logId));
  try {
    await api.deleteSleepLog(token, logId);
    return true;
  } catch (err) {
    setSleepLogs(previous);
    return false;
  }
};
```

---

## 6. Subscription — `subscription.js` and `profile-context.js`

`plan` was held only on the phone, so it reset on reinstall. It now lives on
the server and **comes back on `GET /profile`** as `plan: 'free' | 'premium'`
— the field the app already reads.

```ts
// api.ts
upgradeSubscription: (token: string) =>
  request('/subscription/upgrade', { method: 'POST', headers: authHeaders(token) }),

cancelSubscription: (token: string) =>
  request('/subscription/cancel', { method: 'POST', headers: authHeaders(token) }),
```

In `subscription.js`, replace the two `updateProfile({ plan: ... })` calls:

```js
await api.upgradeSubscription(token);   // in confirmPayment
await api.cancelSubscription(token);    // in confirmCancel
await reloadProfile();                  // so profile.plan updates
```

In `profile-context.js`, stop preserving `plan` locally. This line keeps the
old local value and discards what the server sends:

```js
setProfile((prev) => ({ ...EMPTY_PROFILE, ...data, plan: prev.plan }));
//                                                  ^^^^^^^^^^^^^^^^ remove
```

**The checkout stays simulated** (constraint C-09). The upgrade request has
no body — the card details the screen collects are never sent anywhere, and
nothing payment-related is stored.

---

## Note: the Sleep card

Now has its own model — see section 11.

---

# Round 2 — support types, chat, satisfaction

## 7. Support forms — `support-account.js` and `support-bug.js`

**The account form is broken in the current release.** It sends
`category: 'password'`, `'account'` and `'account-others'`, which the old
backend rejected with a 422 — only "Subscription" ever worked.

**Once this backend is deployed, that form works with no app change.** The
backend now accepts those exact ids, including the hyphenated
`'account-others'`.

### Categories

| Account form | Bug form |
|---|---|
| `password` | `bug_logging` |
| `account` | `bug_insights` |
| `subscription` | `bug_profile` |
| `account_other` | `bug_account` |
| | `bug_other` |

Hyphens are accepted too (`account-others`, `bug-other`).

### Bug form changes

The bug form currently sends `category: 'bug_report'`, puts the area in the
subject, and writes "still happening" into the message text. There are now
real fields for both:

```js
await api.createSupportRequest(token, {
  category: `bug_${area}`,        // bug_logging, bug_insights, ...
  body: description.trim(),       // just the description now
  is_persisting: persisting,      // true / false
});
```

Note `area` must be prefixed with `bug_`. The bug form's `account` option
becomes `bug_account` — without the prefix it would file as an account
request instead.

The old `bug_report` category still works, so the current form keeps
working until it's updated.

### "Others" — the user's own description

For `account_other` or `bug_other`, send what the user typed as
`other_detail`. It becomes the request's subject, so staff see what it's
about at a glance:

```js
await api.createSupportRequest(token, {
  category: 'bug_other',
  other_detail: otherText.trim(),   // e.g. "Dark mode flickers"
  body: description.trim(),
});
```

`subject` is now optional for every category — leave it out and it defaults
to the category's label.

### New response fields

| Field | Meaning |
|---|---|
| `support_type` | `account` or `bug` |
| `category_label` | Display label, e.g. "Logging" |
| `is_persisting` | Bugs only; null for account requests |
| `message_count` | Messages in the conversation |
| `unread_count` | Staff replies the user hasn't opened |
| `last_message_at` | Most recent activity |

`GET /support/requests?type=bug` or `?type=account` filters the list.

---

## 8. Support chat

Each support request is now a conversation. The original description is the
first message; staff and the user can then go back and forth.

```ts
// api.ts
getSupportThread: (token: string, requestId: number) =>
  request<{ request: SupportRequestResponse; messages: SupportMessage[] }>(
    `/support/requests/${requestId}/messages`,
    { headers: authHeaders(token) }
  ),

sendSupportMessage: (token: string, requestId: number, body: string) =>
  request<SupportMessage>(`/support/requests/${requestId}/messages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ body }),
  }),

/** Total unread staff replies, for a badge on the Support tab. */
getSupportUnread: (token: string) =>
  request<{ unread: number }>('/support/unread', { headers: authHeaders(token) }),
```

```ts
type SupportMessage = {
  id: number;
  request_id: number;
  sender_role: 'user' | 'staff';
  sender_name: string | null;   // staff always shown as "Knowtrients Support"
  body: string;
  created_at: string | null;
  read_at: string | null;
  is_mine: boolean;             // true for the user's own messages
};
```

Use `is_mine` to align bubbles left or right — no need to compare ids.

**Behaviour to know about:**

- **Opening the thread marks staff replies as read**, so the unread badge
  clears. Call `getSupportUnread()` again after leaving the thread.
- **Replying to a resolved request reopens it.** A user writing back is
  saying the problem isn't solved. Worth a small notice on the screen —
  "Sending this will reopen your request".
- **Staff appear as "Knowtrients Support"**, not by name.
- Requests created before chat existed are converted into a thread the first
  time they're opened, with the original message and reply in place.

There's no live push yet. Refresh the thread when the screen gains focus, or
poll every 20–30 seconds while it's open.

---

## 9. Satisfaction — sleep, activity and food

Satisfied / not satisfied, for a whole day or for one specific entry.

```ts
// api.ts
rateSatisfaction: (token: string, data: {
  domain: 'sleep' | 'activity' | 'food';
  satisfied: boolean;
  log_date?: string;   // defaults to today
  log_ref?: number;    // a specific meal, night or workout id
  note?: string;
}) =>
  request('/logs/satisfaction', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  }),

listSatisfaction: (token: string, days = 7, domain?: string) =>
  request<any[]>(
    `/logs/satisfaction?days=${days}${domain ? `&domain=${domain}` : ''}`,
    { headers: authHeaders(token) }
  ),

satisfactionSummary: (token: string, days = 30) =>
  request<{ domain: string; satisfied: number; not_satisfied: number;
            total: number; satisfied_rate: number | null }[]>(
    `/logs/satisfaction/summary?days=${days}`,
    { headers: authHeaders(token) }
  ),
```

**Day or entry — pick per screen:**

```js
// Whole day: "How satisfied were you with your sleep today?"
await api.rateSatisfaction(token, { domain: 'sleep', satisfied: true });

// One entry: thumbs on a specific meal
await api.rateSatisfaction(token, {
  domain: 'food', satisfied: false, log_ref: meal.id,
});
```

For an entry rating, the date is taken from the entry itself, so there's no
need to send `log_date`.

Rating the same day — or the same entry — again **replaces** the earlier
rating. `'activities'` is accepted as an alias for `'activity'`.

**Overlap to be aware of:** sleep entries already have a `quality` field
(poor / fair / good / excellent). Satisfaction is a separate, simpler yes/no.
Worth deciding whether the sleep screen needs both.

`DELETE /logs/satisfaction/{id}` withdraws a rating.

---

## 10. Admin website — `sneakyninjaxd/Knowtrients`

The website needs updating too:

- **Category labels.** `js/api.js` has a `CATEGORY_LABELS` map covering only
  the old categories. Every request now includes `category_label`, so use
  that instead and delete the map.
- **Type filter.** `GET /admin/requests?type=bug` or `?type=account` — worth
  a toggle on the requests page.
- **Chat.** `request-detail.html` shows a single reply box. For the full
  conversation:
  - `GET /admin/requests/{id}/messages` — the thread; marks the user's
    messages read
  - `POST /admin/requests/{id}/messages` with `{ body }` — sends a message
    **without** resolving, for follow-up questions
  - The existing `POST /admin/requests/{id}/reply` still works and adds to
    the thread
- **Unread.** Each request in the queue now has `unread_count` — messages
  from the user that staff haven't opened.
- **Satisfaction.** Platform Managers can see aggregate rates at
  `GET /platform/satisfaction`.


---

## 11. Sleep recommendation — `insight.js`

Replaces the last placeholder card. With this, all three insight cards come
from real models.

```ts
// api.ts
getSleepRecommendation: (token: string, logDate?: string) =>
  request<SleepRecommendationResponse>(
    `/recommendation/sleep/today${logDate ? `?log_date=${logDate}` : ''}`,
    { headers: authHeaders(token) }
  ),
```

Same response shape as the fitness recommendation, plus `nights_logged`.
The `insight` object matches the Sleep entry in `src/insights.js` (`id:
'sleep'`), so the existing card renders it unchanged:

```js
const [sleepRec, setSleepRec] = useState(null);

try {
  setSleepRec(await api.getSleepRecommendation(token, toLogDate()));
} catch (err) {
  // 409 = no date of birth, or no sleep logged this week
}

const otherInsights = [
  ...(fitness ? [fitness.insight] : []),
  ...(sleepRec ? [sleepRec.insight] : []),
];
```

`PLACEHOLDER_INSIGHTS` and `src/insights.js` can then be removed entirely.

**Feedback** works the same way, with `domain: 'sleep'` and the response's
`history_id`.

**Sleep satisfaction ratings feed this model.** Without them, the model
assumes typical satisfaction and the explanation says the user hasn't rated
their sleep — so it can't recommend improving restfulness. A quick
"satisfied with last night?" prompt on the sleep screen (section 9) makes
this recommendation noticeably more useful.

**409 responses:** no date of birth on the profile, or no sleep logged in
the past seven days.
