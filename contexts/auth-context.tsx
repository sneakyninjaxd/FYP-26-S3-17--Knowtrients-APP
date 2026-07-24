import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type ApiUser } from '@/services/api';
import { saveToken, getToken, clearToken } from '@/services/auth-storage';

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
  }) => Promise<void>;
  logIn: (data: { email: string; password: string }) => Promise<void>;
  logOut: () => Promise<void>;
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
  }

  async function logIn(data: { email: string; password: string }) {
    const result = await api.logIn(data);
    await saveToken(result.access_token);
    setToken(result.access_token);
    setUser(result.user);
  }

  async function logOut() {
    await clearToken();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signUp, logIn, logOut }}>
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
