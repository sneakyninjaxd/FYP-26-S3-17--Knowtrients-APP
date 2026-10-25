/**
 * API client for the Knowtrients FastAPI backend.
 *
 * The base URL comes from EXPO_PUBLIC_API_URL (set in your .env file).
 * Expo inlines any env var prefixed with EXPO_PUBLIC_ at build time, so it's
 * safe to read directly from process.env in app code.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://knowtrients-backend-database.onrender.com';

export type ApiUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  onboarding_complete: boolean;
  role: string;
  display_id: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: ApiUser;
};

export type ProfileResponse = {
  date_of_birth: string | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  health_conditions: string[];
  other_condition: string | null;
  goals: string[];
  other_goal: string | null;
  target_weight_kg: number | null;
  activity_level: string | null;
  dietary_preferences: string[];
  other_preference: string | null;
  onboarding_complete: boolean;
  age: number | null;
  bmi: number | null;
};

/** age and bmi are derived server-side, so they're never sent. */
export type ProfileUpsert = Omit<ProfileResponse, 'age' | 'bmi'>;

/** Which part of the app a rating or recommendation is about. */
export type Domain = 'diet' | 'fitness' | 'sleep' | 'activity' | 'food';

// ---------------------------------------------------------------------------
// Food
// ---------------------------------------------------------------------------

/** A catalogue food, as returned by search and by id. */
export type FoodResponse = {
  id: number;
  name: string;
  brand: string | null;
  serving_description: string | null;
  serving_grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  vegetable_servings: number;
};

/** One logged entry. Nutrition here is the computed amount for the portion. */
export type FoodLogResponse = {
  id: number;
  log_date: string;
  meal_type: string;
  food_name: string;
  quantity: number;
  unit: string;
  grams: number | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  vegetable_servings: number;
  created_at: string | null;
};

/**
 * Two mutually exclusive modes:
 *  - catalogue entry: set food_id (+ quantity/unit/grams). The server computes
 *    nutrition from the portion; do NOT send macro fields.
 *  - custom entry: set food_name and the macro fields yourself, no food_id.
 */
export type FoodLogCreate = {
  meal_type: string;
  log_date?: string;
  food_id?: number;
  food_name?: string;
  quantity?: number;
  unit?: string;
  grams?: number;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  saturated_fat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  vegetable_servings?: number;
};

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

/** `hours` is required; bedtime and wake_time are free-form display strings. */
export type SleepLogCreate = {
  hours: number;
  quality?: string | null;
  bedtime?: string | null;
  wake_time?: string | null;
  notes?: string | null;
  log_date?: string;
};

export type SleepLogResponse = {
  id: number;
  log_date: string;
  hours: number;
  quality: string | null;
  bedtime: string | null;
  wake_time: string | null;
  notes: string | null;
};

/**
 * Hours between two "HH:MM" times, wrapping past midnight.
 * 23:30 → 07:00 gives 7.5, not -16.5.
 */
export function sleepHours(bedtime: string, wakeTime: string): number {
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const diff = (mins(wakeTime) - mins(bedtime) + 1440) % 1440;
  return Math.round((diff / 60) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export type ActivityLogCreate = {
  activity_type: string;
  duration_minutes: number;
  intensity?: string | null;
  calories_burned?: number | null;
  notes?: string | null;
  log_date?: string;
};

export type ActivityLogResponse = {
  id: number;
  log_date: string;
  activity_type: string;
  duration_minutes: number;
  intensity: string | null;
  calories_burned: number | null;
  notes: string | null;
};

/** One day of the activity range endpoint. */
export type ActivityDay = {
  date: string;
  minutes: number;
  calories: number;
  count: number;
  steps: number | null;
};

// ---------------------------------------------------------------------------
// Device metrics (Health Connect)
// ---------------------------------------------------------------------------

export type DeviceMetricsResponse = {
  log_date: string;
  steps: number | null;
  active_calories: number | null;
  source: string;
};

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

/**
 * One SHAP factor: how much this feature pushed the recommendation.
 * `contribution` is signed — positive pushes toward, negative away.
 */
export type Factor = {
  feature: string;
  label: string;
  value: number;
  contribution: number;
  direction: string;
};

/** The runner-up recommendation, with its own confidence. */
export type Alternative = {
  recommendation: string;
  confidence: number;
};

export type RecommendationResponse = {
  /**
   * Identifies this user's specific recommendation. Feedback is keyed on
   * this, NOT on recommendation_id — that one identifies the kind of advice
   * and is shared by everyone who received it.
   */
  history_id: number | null;
  recommendation: string;
  recommendation_id: number;
  confidence: number;
  explanation: string[];
  factors: Factor[];
  alternative: Alternative;
};

export type FeedbackResponse = {
  id: number;
  domain: string;
  recommendation_ref: number;
  rating: string;
  reason: string | null;
  created_at: string | null;
};

// ---------------------------------------------------------------------------
// Satisfaction
// ---------------------------------------------------------------------------

export type SatisfactionResponse = {
  id: number;
  domain: string;
  log_date: string;
  log_ref: number | null;
  satisfied: boolean;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SatisfactionSummary = {
  domain: string;
  satisfied: number;
  not_satisfied: number;
  total: number;
  satisfied_rate: number | null;
};

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export type SubscriptionResponse = {
  plan: string;
  status: string;
  started_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  is_premium: boolean;
};

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

/**
 * Account categories and bug categories share one enum server-side; the
 * prefix decides which form a request came from. A wrong value is a 422.
 */
export type SupportCategory =
  | 'password'
  | 'account'
  | 'subscription'
  | 'account_other'
  | 'bug_logging'
  | 'bug_insights'
  | 'bug_profile'
  | 'bug_account'
  | 'bug_other';

/**
 * `subject` is optional — left out, it defaults to the category's label.
 * For an "others" category, `other_detail` carries the user's own short
 * description and becomes the subject. `is_persisting` is bug reports only.
 */
export type SupportRequestCreate = {
  category?: SupportCategory;
  subject?: string | null;
  body: string;
  other_detail?: string | null;
  is_persisting?: boolean | null;
};

export type SupportRequestResponse = {
  id: number;
  display_id: string | null;
  category: string;
  subject: string;
  body: string;
  status: string;
  reply: string | null;
  created_at: string | null;
  replied_at: string | null;
  resolved_at: string | null;
  support_type?: string;
  category_label?: string;
  is_persisting?: boolean | null;
  message_count?: number;
  unread_count?: number;
  last_message_at?: string | null;
  user_id: number;
};

export type SupportMessageResponse = {
  id: number;
  request_id: number;
  sender_role: string;
  sender_name: string | null;
  body: string;
  created_at: string | null;
  read_at: string | null;
  is_mine: boolean;
};

export type SupportThread = {
  request: SupportRequestResponse;
  messages: SupportMessageResponse[];
};

// ---------------------------------------------------------------------------
// Daily summary
// ---------------------------------------------------------------------------

export type DailyTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  vegetable_servings: number;
  water_ml: number;
};

/** One meal row on the Food Log screen. */
export type MealSummary = {
  meal_type: string;
  label: string;
  item_count: number;
  calories: number;
};

/** Everything the dashboard needs for one day. Only meals with entries appear. */
export type DailySummary = {
  log_date: string;
  totals: DailyTotals;
  meals: MealSummary[];
  sleep_hours: number | null;
  activity_minutes: number;
  entry_count: number;
};

/**
 * Formats a Date as YYYY-MM-DD in the device's local timezone.
 *
 * Deliberately not toISOString(), which converts to UTC first — in SGT that
 * shifts anything before 8am back onto the previous day.
 */
export function toLogDate(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Extracts a readable message from FastAPI's error shape, which can be:
 * - { detail: "some string" }                         (HTTPException)
 * - { detail: [{ msg: "...", loc: [...] }, ...] }      (Pydantic validation errors)
 */
function extractErrorMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === 'string') {
      return detail[0].msg;
    }
  }
  return 'Something went wrong. Please try again.';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      'Could not reach the server. Check your internet connection or the API URL in .env.',
      0
    );
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(body), response.status);
  }

  return body as T;
}

/** Every authenticated call needs the same header; this keeps it in one place. */
function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const api = {
  signUp: (data: {
    email: string;
    first_name: string;
    last_name: string;
    password: string;
    retype_password: string;
  }) =>
    request<AuthResponse>('/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logIn: (data: { email: string; password: string }) =>
    request<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMe: (token: string) =>
    request<ApiUser>('/me', {
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------

  getProfile: (token: string) =>
    request<ProfileResponse>('/profile', {
      headers: authHeaders(token),
    }),

  /** Partial update — omitted fields are left untouched by the backend. */
  updateProfile: (token: string, data: Partial<ProfileUpsert>) =>
    request<ProfileResponse>('/profile', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  // -------------------------------------------------------------------------
  // Food catalogue
  // -------------------------------------------------------------------------

  /** Backs the food search screen. Max limit is 50. */
  searchFoods: (token: string, q: string, limit = 20) =>
    request<FoodResponse[]>(
      `/foods/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      { headers: authHeaders(token) }
    ),

  getFood: (token: string, foodId: number) =>
    request<FoodResponse>(`/foods/${foodId}`, {
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Food logs
  // -------------------------------------------------------------------------

  /** Entries for one day, optionally narrowed to a single meal. */
  listFoodLogs: (token: string, logDate?: string, mealType?: string) => {
    const params = new URLSearchParams();
    if (logDate) params.set('log_date', logDate);
    if (mealType) params.set('meal_type', mealType);
    const qs = params.toString();
    return request<FoodLogResponse[]>(`/logs/food${qs ? `?${qs}` : ''}`, {
      headers: authHeaders(token),
    });
  },

  createFoodLog: (token: string, data: FoodLogCreate) =>
    request<FoodLogResponse>('/logs/food', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  /** Returns 204 with no body; request() already tolerates the empty response. */
  deleteFoodLog: (token: string, logId: number) =>
    request<void>(`/logs/food/${logId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Sleep
  // -------------------------------------------------------------------------

  /** Upsert — one row per user per date, so this replaces rather than adds. */
  setSleepLog: (token: string, data: SleepLogCreate) =>
    request<SleepLogResponse>('/logs/sleep', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  /** Backs the statistics screen. Max 90 days. */
  listSleepLogs: (token: string, days = 7) =>
    request<SleepLogResponse[]>(`/logs/sleep?days=${days}`, {
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Activity logs
  // -------------------------------------------------------------------------

  /** One day at a time. For a range, use getActivityRange instead. */
  listActivityLogs: (token: string, logDate?: string) =>
    request<ActivityLogResponse[]>(
      `/logs/activity${logDate ? `?log_date=${logDate}` : ''}`,
      { headers: authHeaders(token) }
    ),

  /**
   * One call for a whole range, replacing the per-day calls the statistics
   * screen and the health report were making.
   */
  getActivityRange: (token: string, days = 7, endDate?: string) => {
    const params = new URLSearchParams({ days: String(days) });
    if (endDate) params.set('end_date', endDate);
    return request<ActivityDay[]>(`/logs/activity/range?${params}`, {
      headers: authHeaders(token),
    });
  },

  createActivityLog: (token: string, data: ActivityLogCreate) =>
    request<ActivityLogResponse>('/logs/activity', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  /** Returns 204 with no body; request() already tolerates the empty response. */
  deleteActivityLog: (token: string, logId: number) =>
    request<void>(`/logs/activity/${logId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Device metrics (Health Connect sync)
  // -------------------------------------------------------------------------

  /**
   * Stores a day's steps and calories. Replaces rather than adds, because
   * Health Connect reports a running daily total — a second sync the same
   * afternoon carries the whole day, so adding would double-count.
   *
   * A field sent as null is left as it was, so a sync that could read steps
   * but not calories won't erase an earlier calorie figure.
   */
  syncDeviceMetrics: (
    token: string,
    data: {
      steps?: number | null;
      active_calories?: number | null;
      source?: string;
      log_date?: string;
    }
  ) =>
    request<DeviceMetricsResponse>('/logs/steps', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ source: 'health_connect', ...data }),
    }),

  listDeviceMetrics: (token: string, days = 7) =>
    request<DeviceMetricsResponse[]>(`/logs/steps?days=${days}`, {
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Water
  // -------------------------------------------------------------------------

  setWaterLog: (token: string, amountMl: number, logDate?: string) =>
    request<{ amount_ml: number; log_date?: string }>('/logs/water', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ amount_ml: amountMl, log_date: logDate }),
    }),

  // -------------------------------------------------------------------------
  // Recommendation
  // -------------------------------------------------------------------------

  /**
   * Builds the model's ten features from what the user actually logged, then
   * returns the recommendation and its SHAP explanation. Needs logged data
   * for that date to be meaningful.
   */
  getTodaysRecommendation: (token: string, logDate?: string) =>
    request<RecommendationResponse>(
      `/recommendation/today${logDate ? `?log_date=${logDate}` : ''}`,
      { headers: authHeaders(token) }
    ),

  /** Past recommendations, most recent first. */
  getRecommendationHistory: (token: string, limit = 30) =>
    request<RecommendationResponse[]>(`/recommendation/history?limit=${limit}`, {
      headers: authHeaders(token),
    }),

  /** Same shape as the diet recommendation, so the app can render both. */
  getTodaysFitnessRecommendation: (token: string) =>
    request<RecommendationResponse>('/recommendation/fitness/today', {
      headers: authHeaders(token),
    }),

  getFitnessRecommendationHistory: (token: string, days = 30) =>
    request<RecommendationResponse[]>(
      `/recommendation/fitness/history?days=${days}`,
      { headers: authHeaders(token) }
    ),

  // -------------------------------------------------------------------------
  // Recommendation feedback
  // -------------------------------------------------------------------------

  /**
   * `recommendation_ref` is the `history_id` from the recommendation — not
   * `recommendation_id`. Rating again replaces the earlier rating, so a user
   * who changes their mind is counted once. A thumbs-down needs a reason.
   */
  submitRecommendationFeedback: (
    token: string,
    data: {
      recommendation_ref: number;
      rating: 'up' | 'down';
      domain?: Domain;
      reason?: string | null;
    }
  ) =>
    request<FeedbackResponse>('/recommendation/feedback', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ domain: 'diet', ...data }),
    }),

  /** Withdraws a rating, so a mis-tap can be undone. */
  withdrawRecommendationFeedback: (
    token: string,
    recommendationRef: number,
    domain: Domain = 'diet'
  ) => {
    const params = new URLSearchParams({
      domain,
      recommendation_ref: String(recommendationRef),
    });
    return request<void>(`/recommendation/feedback?${params}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  /** Restores thumbs state after a restart instead of showing all unrated. */
  listMyFeedback: (token: string) =>
    request<FeedbackResponse[]>('/recommendation/feedback', {
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Daily satisfaction
  // -------------------------------------------------------------------------

  /**
   * Rates a domain as satisfied or not. Omit `log_ref` to rate the whole day;
   * pass a log's id to rate one meal, night or workout — the server then takes
   * the date from that entry so the two can't disagree.
   */
  setSatisfaction: (
    token: string,
    data: {
      domain: Domain;
      satisfied: boolean;
      log_date?: string;
      log_ref?: number | null;
      note?: string | null;
    }
  ) =>
    request<SatisfactionResponse>('/logs/satisfaction', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  listSatisfaction: (token: string, days = 7, domain?: Domain) => {
    const params = new URLSearchParams({ days: String(days) });
    if (domain) params.set('domain', domain);
    return request<SatisfactionResponse[]>(`/logs/satisfaction?${params}`, {
      headers: authHeaders(token),
    });
  },

  getSatisfactionSummary: (token: string, days = 30) =>
    request<SatisfactionSummary[]>(`/logs/satisfaction/summary?days=${days}`, {
      headers: authHeaders(token),
    }),

  /** Clears a rating, so an un-tapped thumb really is "not answered". */
  deleteSatisfaction: (token: string, checkinId: number) =>
    request<void>(`/logs/satisfaction/${checkinId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  /** The user's real plan. Replaces the old client-side `plan` flag. */
  getSubscription: (token: string) =>
    request<SubscriptionResponse>('/subscription', {
      headers: authHeaders(token),
    }),

  /** Simulated upgrade — takes no body, so no payment data is involved. */
  upgradeSubscription: (token: string) =>
    request<SubscriptionResponse>('/subscription/upgrade', {
      method: 'POST',
      headers: authHeaders(token),
    }),

  cancelSubscription: (token: string) =>
    request<SubscriptionResponse>('/subscription/cancel', {
      method: 'POST',
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Support
  // -------------------------------------------------------------------------

  /** Raise a support request from the app; lands in the admin queue. */
  createSupportRequest: (token: string, data: SupportRequestCreate) =>
    request<SupportRequestResponse>('/support/requests', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    }),

  /** The user's own tickets, newest activity first, with unread counts. */
  listSupportRequests: (token: string, type?: string) =>
    request<SupportRequestResponse[]>(
      `/support/requests${type ? `?type=${encodeURIComponent(type)}` : ''}`,
      { headers: authHeaders(token) }
    ),

  /** The request plus its full conversation. */
  getSupportMessages: (token: string, requestId: number) =>
    request<SupportThread>(`/support/requests/${requestId}/messages`, {
      headers: authHeaders(token),
    }),

  sendSupportMessage: (token: string, requestId: number, body: string) =>
    request<SupportMessageResponse>(`/support/requests/${requestId}/messages`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ body }),
    }),

  /** For a badge on the Help Support tile. */
  getSupportUnreadCount: (token: string) =>
    request<{ unread: number }>('/support/unread', {
      headers: authHeaders(token),
    }),

  // -------------------------------------------------------------------------
  // Daily summary
  // -------------------------------------------------------------------------

  /** One call for the whole dashboard: totals, meal rows, sleep, activity. */
  getDailySummary: (token: string, logDate?: string) =>
    request<DailySummary>(
      `/logs/summary${logDate ? `?log_date=${logDate}` : ''}`,
      { headers: authHeaders(token) }
    ),
};