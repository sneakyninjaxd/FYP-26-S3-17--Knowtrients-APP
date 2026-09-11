/**
 * API client for the Knowtrients FastAPI backend.
 *
 * The base URL comes from EXPO_PUBLIC_API_URL (set in your .env file).
 * Expo inlines any env var prefixed with EXPO_PUBLIC_ at build time, so it's
 * safe to read directly from process.env in app code.
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://your-app-name.up.railway.app';

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

/** No steps field — the backend tracks type, duration, intensity, calories. */
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
  recommendation: string;
  recommendation_id: number;
  confidence: number;
  explanation: string[];
  factors: Factor[];
  alternative: Alternative;
};

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

/** subject is 3–200 chars, body 3–5000. Category defaults to "other". */
/** Enforced server-side as an enum — a wrong value comes back as a 422. */
// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------

/** Enforced server-side as an enum — a wrong value comes back as a 422. */
export type SupportCategory =
  | 'password_change'
  | 'subscription'
  | 'account_recovery'
  | 'bug_report'
  | 'other';

/** subject is 3–200 chars, body 3–5000. Category defaults to "other". */
export type SupportRequestCreate = {
  category?: SupportCategory;
  subject: string;
  body: string;
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
  user_id: number;
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

  /** One day at a time — there's no date-range filter on this endpoint. */
  listActivityLogs: (token: string, logDate?: string) =>
    request<ActivityLogResponse[]>(
      `/logs/activity${logDate ? `?log_date=${logDate}` : ''}`,
      { headers: authHeaders(token) }
    ),

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

  /** The user's own tickets, newest first — includes any admin reply. */
  listSupportRequests: (token: string) =>
    request<SupportRequestResponse[]>('/support/requests', {
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