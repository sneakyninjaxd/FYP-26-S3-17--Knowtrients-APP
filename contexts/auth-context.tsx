import { api, ApiError, type ApiUser, type AuthResponse } from '@/services/api';
import { clearToken, getToken, saveToken } from '@/services/auth-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type AuthContextValue = {
  user: ApiUser | null;
  token: string | null;
  isLoading: boolean; // true while restoring a session on app start
  signUp: (data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    retypePassword: string;
  }) => Promise<AuthResponse>;
  logIn: (data: { email: string; password: string }) => Promise<AuthResponse>;
  logOut: () => Promise<void>;
  /** Re-reads the signed-in user from the server. */
  refreshUser: () => Promise<ApiUser | null>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app start, check for a saved token and try to restore the session.
  useEffect(() => {
    (async () => {
      const savedToken = await getToken();
      if (!savedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await api.getMe(savedToken);
        setToken(savedToken);
        setUser(me);
      } catch {
        // Token expired or invalid — clear it and fall through to login.
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);
  async function signUp(data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    retypePassword: string;
  }) {
    const result = await api.signUp({
      email: data.email,
      first_name: data.firstName,
      last_name: data.lastName,
      password: data.password,
      retype_password: data.retypePassword,
    });
    await saveToken(result.access_token);
    setToken(result.access_token);
    setUser(result.user);
    return result;
  }

  async function logIn(data: { email: string; password: string }) {
    const result = await api.logIn(data);
    await saveToken(result.access_token);
    setToken(result.access_token);
    setUser(result.user);
    return result;
  }

  async function logOut() {
    await clearToken();
    setToken(null);
    setUser(null);
  }

  /**
   * Re-reads the user after something changes them server-side — a renamed
   * account, say. Without this the old name stays on screen until the next
   * sign-in, because `user` is only set at login and at start-up.
   *
   * A failure is deliberately swallowed: this is a refresh, not an
   * authentication step, and signing someone out because one request didn't
   * land would be a worse outcome than showing a slightly stale name.
   */
  async function refreshUser() {
    if (!token) return null;
    try {
      const me = await api.getMe(token);
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, signUp, logIn, logOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { ApiError };
