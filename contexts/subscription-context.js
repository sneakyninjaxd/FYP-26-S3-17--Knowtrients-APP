/**
 * Subscription state, read from the server rather than held locally.
 *
 * Replaces the `plan` field that used to live on the profile context: that
 * one reset on logout and could be flipped from the client, so every
 * premium gate in the app was decorative. This one reflects the
 * subscriptions table.
 */
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/services/api';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const SubscriptionContext = createContext(null);

const FREE = {
  plan: 'free',
  status: 'active',
  started_at: null,
  current_period_end: null,
  cancelled_at: null,
  is_premium: false,
};

export function SubscriptionProvider({ children }) {
  const { token } = useAuth();

  const [subscription, setSubscription] = useState(FREE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setSubscription(FREE);
      return;
    }

    setIsLoading(true);
    try {
      setSubscription(await api.getSubscription(token));
      setError(null);
    } catch (err) {
      // Falling back to free is the safe failure: a network blip shouldn't
      // hand someone premium features.
      console.warn('Could not load subscription', err);
      setSubscription(FREE);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Simulated upgrade. The request carries no body, so no payment details
   * are sent anywhere — there is no payment processor in this project.
   */
  const upgrade = async () => {
    if (!token) return false;

    setError(null);
    try {
      setSubscription(await api.upgradeSubscription(token));
      return true;
    } catch (err) {
      setError(err?.message ?? 'Could not complete the upgrade.');
      return false;
    }
  };

  const cancel = async () => {
    if (!token) return false;

    setError(null);
    try {
      setSubscription(await api.cancelSubscription(token));
      return true;
    } catch (err) {
      setError(err?.message ?? 'Could not cancel the subscription.');
      return false;
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plan: subscription?.plan ?? 'free',
        isPremium: Boolean(subscription?.is_premium),
        isLoading,
        error,
        refresh,
        upgrade,
        cancel,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext) ?? {
  subscription: FREE,
  plan: 'free',
  isPremium: false,
  isLoading: false,
  error: null,
  refresh: async () => {},
  upgrade: async () => false,
  cancel: async () => false,
};