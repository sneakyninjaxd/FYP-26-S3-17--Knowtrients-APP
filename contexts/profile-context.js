import { useAuth } from '@/contexts/auth-context';
import { api } from '@/services/api';
import { createContext, useContext, useEffect, useState } from 'react';

const ProfileContext = createContext(null);

const EMPTY_PROFILE = {
  // Not a backend field — subscription isn't in their schema yet.
  plan: 'free',

  date_of_birth: null,
  gender: null,
  height_cm: null,
  weight_kg: null,
  health_conditions: [],
  other_condition: '',

  goals: [],
  other_goal: '',
  target_weight_kg: null,

  activity_level: null,
  dietary_preferences: [],
  other_preference: '',

  onboarding_complete: false,

  // Computed server-side from date_of_birth, height_cm and weight_kg.
  age: null,
  bmi: null,
};

export function ProfileProvider({ children }) {
  const { token } = useAuth();

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [isLoading, setIsLoading] = useState(false);

  // Load whenever a token appears — on login, or when a saved session restores.
  useEffect(() => {
    if (!token) {
      setProfile(EMPTY_PROFILE);
      return;
    }

    (async () => {
      setIsLoading(true);
      try {
        const data = await api.getProfile(token);
        setProfile((prev) => ({ ...EMPTY_PROFILE, ...data, plan: prev.plan }));
      } catch (err) {
        console.warn('Could not load profile', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token]);

  /**
   * Saves a partial update. The screen sees the change immediately, then the
   * server's response replaces it — which brings back computed age and bmi.
   */
  const updateProfile = async (changes) => {
    setProfile((prev) => ({ ...prev, ...changes }));

    if (!token) return;

    // `plan` is local-only; sending it would be rejected by the schema.
    const { plan, ...payload } = changes;
    if (Object.keys(payload).length === 0) return;

    try {
      const data = await api.updateProfile(token, payload);
      setProfile((prev) => ({ ...prev, ...data }));
    } catch (err) {
      console.warn('Could not save profile', err);
    }
  };

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, isLoading }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);