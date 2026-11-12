import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/contexts/subscription-context';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Card order on screen, whatever order the server returns them in. */
const PLAN_ORDER = ['free', 'premium'];

const CURRENCY_SYMBOLS = { SGD: 'S$', USD: '$', MYR: 'RM', GBP: '£', EUR: '€' };

/**
 * "S$10/month" from the stored price, currency and billing period.
 *
 * The period is a number of days on the server, so 30 and 365 are named
 * rather than printed as "per 30 days", which reads like a technicality.
 */
const formatPrice = (plan) => {
  if (!plan || !plan.price) return null;

  const symbol = CURRENCY_SYMBOLS[plan.currency] ?? `${plan.currency} `;
  const amount = Number.isInteger(plan.price) ? plan.price : plan.price.toFixed(2);

  const days = plan.billing_period_days ?? 30;
  const period =
    days === 30 || days === 31 ? 'month'
      : days === 365 ? 'year'
        : days === 7 ? 'week'
          : `${days} days`;

  return `${symbol}${amount}/${period}`;
};

/**
 * Where Stripe sends the browser back to. Matches the `scheme` in app.json,
 * so the hosted page hands control to the app rather than a web page.
 */
/**
 * Where Stripe sends the browser when checkout finishes, and what
 * openAuthSessionAsync watches for to know the sheet can close.
 *
 * The path has to be a real route — this screen is at /account/subscription,
 * not /subscription — or the deep link lands on Expo Router's unmatched-route
 * page. It must also match STRIPE_SUCCESS_URL on the server.
 */
const RETURN_URL = 'knowtrients://account/subscription';

/** "3 November 2026" — for the renewal line. */
const formatDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
};

export default function Subscription() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { subscription, isPremium, isLoading, error, cancel, refresh } =
    useSubscription();

  /** Checkout can fail before the browser ever opens — say so here. */
  const [checkoutError, setCheckoutError] = useState(null);

  const currentPlan = isPremium ? 'premium' : 'free';

  /**
   * Plans come from the database, so a price or feature change made by a
   * Platform Manager shows here without shipping a new build.
   */
  const [plans, setPlans] = useState([]);
  const [plansError, setPlansError] = useState(null);

  /**
   * On focus rather than on mount: the router keeps this screen alive, so a
   * plan edited while the app is open would otherwise not appear until the
   * whole tree was torn down — which is to say, until the user logged out.
   */
  useFocusEffect(
    useCallback(() => {
      let active = true;

      api
        .listPlans()
        .then((rows) => {
          if (!active) return;

          // Free before premium, whatever order the server returns.
          const sorted = [...rows].sort(
            (a, b) => PLAN_ORDER.indexOf(a.plan_key) - PLAN_ORDER.indexOf(b.plan_key)
          );
          setPlans(sorted);
          setPlansError(null);
        })
        .catch((err) => {
          if (active) setPlansError(err?.message ?? 'Could not load the plans.');
        });

      // Stops a slow response from landing after the screen has gone.
      return () => {
        active = false;
      };
    }, [])
  );

  const [showCancel, setShowCancel] = useState(false);
  const [processing, setProcessing] = useState(false);

  /**
   * Payment happens on Stripe's own page, so no card details pass through
   * the app or our server.
   *
   * When the browser closes we only refetch — premium is granted by Stripe's
   * signed webhook, not by the user arriving back here. If the webhook is
   * still in flight the plan will read as free for a moment; the refetch on
   * focus catches up.
   */
  const startCheckout = async () => {
    if (!token || processing) return;

    setProcessing(true);
    setCheckoutError(null);

    try {
      const { url } = await api.createCheckout(token);
      await WebBrowser.openAuthSessionAsync(url, RETURN_URL);
      await refresh();
    } catch (err) {
      setCheckoutError(err?.message ?? 'Could not start checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const confirmCancel = async () => {
    setProcessing(true);
    const ok = await cancel();
    setProcessing(false);

    if (ok) setShowCancel(false);
  };

  const renewsOn = formatDate(subscription?.current_period_end);
  const cancelledOn = formatDate(subscription?.cancelled_at);

  /** For the checkout modal, which quotes the price before you commit. */
  const premium = plans.find((p) => p.plan_key === 'premium');
  const premiumPrice = formatPrice(premium);
  const premiumFeatures = premium?.features ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 + insets.bottom }}>
        {/* Logo */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoGlyph}>✦</Text>
            </View>
            <Text style={styles.logo}>Knowtrients</Text>
          </View>

          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />

        <View>
          <Text style={styles.title}>Subscription</Text>
          <Text style={styles.description}>Choose your plan</Text>

          {isLoading && (
            <ActivityIndicator
              size="small"
              color="#4ECBA0"
              style={{ marginBottom: 16 }}
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}
          {plansError && <Text style={styles.error}>{plansError}</Text>}
          {checkoutError && <Text style={styles.error}>{checkoutError}</Text>}

          {plans.length === 0 && !plansError && (
            <ActivityIndicator
              size="small"
              color="#4ECBA0"
              style={{ marginTop: 20 }}
            />
          )}

          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.plan_key;
            const price = formatPrice(plan);

            return (
              <View
                key={plan.plan_key}
                style={[styles.planCard, isCurrent && styles.planCardActive]}
              >
                {isCurrent && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Current</Text>
                  </View>
                )}

                <Text style={styles.planName}>{plan.name}</Text>

                {(plan.features ?? []).map((f) => (
                  <Text key={f} style={styles.feature}>• {f}</Text>
                ))}

                {/* What the server actually says about this subscription. */}
                {isCurrent && plan.plan_key === 'premium' && (
                  <Text style={styles.periodNote}>
                    {cancelledOn
                      ? `Cancelled ${cancelledOn}. Premium remains active until ${renewsOn ?? 'the end of the period'}.`
                      : renewsOn
                        ? `Renews on ${renewsOn}.`
                        : ''}
                  </Text>
                )}

                {price && (
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{price}</Text>
                    <TouchableOpacity
                      style={styles.planButton}
                      disabled={isLoading || processing}
                      onPress={isCurrent ? () => setShowCancel(true) : startCheckout}
                    >
                      <Text style={styles.planButtonText}>
                        {isCurrent
                          ? 'Cancel Subscription'
                          : processing
                            ? 'Opening…'
                            : 'Get Premium'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Cancel subscription modal */}
      <Modal visible={showCancel} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={{ padding: 24 }}>
              <Text style={styles.modalTitle}>Cancel Premium?</Text>
              {/* Names the features the plan actually lists, rather than a
                  copy that drifts when a Platform Manager edits the plan. */}
              <Text style={styles.modalSubtitle}>
                You&apos;ll lose access to
                {premiumFeatures.length
                  ? ` ${premiumFeatures.join(', ').toLowerCase()}`
                  : ' the Premium features'}
                {renewsOn ? ` after ${renewsOn}` : ''}.
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  disabled={processing}
                  onPress={() => setShowCancel(false)}
                >
                  <Text style={styles.cancelText}>Keep Premium</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dangerButton}
                  disabled={processing}
                  onPress={confirmCancel}
                >
                  <Text style={styles.dangerText}>
                    {processing ? 'Cancelling…' : 'Cancel Plan'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020D09',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingVertical: 16,
  },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  logoBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#48DDB0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoGlyph: { fontSize: 15, color: '#00382B' },

  logo: { color: '#fff', fontSize: 19, fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#123B2F' },

  title: {
    color: '#FFFFFF',
    fontSize: 35,
    fontFamily: 'serif',
    marginBottom: 5,
    paddingLeft: 25,
    paddingTop: 10,
  },

  description: {
    color: '#3AA889',
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 20,
    paddingLeft: 25,
  },

  error: {
    color: '#E07A5F',
    fontSize: 11,
    paddingHorizontal: 25,
    marginBottom: 12,
  },

  planCard: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 25,
    marginBottom: 16,
  },

  planCardActive: { borderColor: '#48DDB0' },

  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#48DDB0',
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  badgeText: { color: '#00382B', fontSize: 10, fontWeight: '600' },

  planName: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'serif',
    marginBottom: 12,
  },

  feature: { color: '#D4E6DF', fontSize: 12, lineHeight: 20 },

  periodNote: {
    color: '#60766E',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 12,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  price: { color: '#48DDB0', fontSize: 22, fontWeight: '600' },

  planButton: {
    backgroundColor: '#102A21',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  planButtonText: { color: '#fff', fontSize: 12, textAlign: 'center' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    backgroundColor: '#0B2119',
    borderRadius: 16,
    maxHeight: '88%',
  },

  modalTitle: { color: '#fff', fontSize: 22, fontFamily: 'serif' },

  modalSubtitle: { color: '#D4E6DF', fontSize: 12, marginTop: 4, lineHeight: 17 },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 22 },

  cancelButton: {
    flex: 1,
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  cancelText: { color: '#fff', fontSize: 13 },

  dangerButton: {
    flex: 1,
    backgroundColor: '#E0453F',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  dangerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});