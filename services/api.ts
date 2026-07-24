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
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: ApiUser;
};

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
      headers: { Authorization: `Bearer ${token}` },
    }),
};
