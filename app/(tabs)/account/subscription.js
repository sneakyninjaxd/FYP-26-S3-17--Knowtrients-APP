import { useProfile } from '@/contexts/profile-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const PLANS = [
  {
    id: 'free',
    name: 'Free Plan',
    price: null,
    features: [
      '1 recommendation per day',
      'Technical explanations only',
      'View progress history for the last 7 days',
      'View regular progress charts',
      'Manual sleep input',
    ],
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    price: '$10/month',
    features: [
      'Unlimited recommendations',
      'Toggle between technical and plain-language explanations',
      'View full progress history',
      'View advanced progress charts',
      'Automatic sleep tracking',
      'Generate formatted health report',
    ],
  },
];

/** Groups digits in fours as the user types: 4111111111111111 → 4111 1111 ... */
const formatCardNumber = (value) =>
  value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const formatExpiry = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

export default function Subscription() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useProfile();
  const currentPlan = profile.plan;
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const openCheckout = () => {
    setCardName('');
    setCardNumber('');
    setExpiry('');
    setCvv('');
    setShowCheckout(true);
  };

  const canPay =
    cardName.trim().length > 1 &&
    cardNumber.replace(/\s/g, '').length === 16 &&
    expiry.length === 5 &&
    cvv.length >= 3;

  /**
   * Nothing is sent anywhere — there's no payment integration and no
   * subscription field on the backend. The delay just mimics a real
   * checkout so the flow is demonstrable.
   */
  const confirmPayment = () => {
    if (!canPay || processing) return;
    setProcessing(true);
    setTimeout(() => {
      updateProfile({ plan: 'premium' });
      setProcessing(false);
      setShowCheckout(false);
    }, 900);
  };

  const confirmCancel = () => {
    updateProfile({ plan: 'free' });
    setShowCancel(false);
  };

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

          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;

            return (
              <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCardActive]}>
                {isCurrent && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Current</Text>
                  </View>
                )}

                <Text style={styles.planName}>{plan.name}</Text>

                {plan.features.map((f) => (
                  <Text key={f} style={styles.feature}>• {f}</Text>
                ))}

                {plan.price && (
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{plan.price}</Text>
                    <TouchableOpacity
                      style={styles.planButton}
                      onPress={isCurrent ? () => setShowCancel(true) : openCheckout}
                    >
                      <Text style={styles.planButtonText}>
                        {isCurrent ? 'Cancel Subscription' : 'Get Premium'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Checkout modal */}
      <Modal visible={showCheckout} transparent animationType="fade">
        <View style={styles.overlay}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ padding: 24 }}>
            <Text style={styles.modalTitle}>Upgrade to Premium</Text>
            <Text style={styles.modalSubtitle}>$10 per month, cancel any time</Text>
            <Text style={styles.fieldLabel}>Name on card</Text>
            <TextInput
              style={styles.input}
              placeholder="John Doe"
              placeholderTextColor="#60766E"
              value={cardName}
              onChangeText={setCardName}
            />

            <Text style={styles.fieldLabel}>Card number</Text>
            <TextInput
              style={styles.input}
              placeholder="4111 1111 1111 1111"
              placeholderTextColor="#60766E"
              keyboardType="number-pad"
              value={cardNumber}
              onChangeText={(v) => setCardNumber(formatCardNumber(v))}
            />

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Expiry</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MM/YY"
                  placeholderTextColor="#60766E"
                  keyboardType="number-pad"
                  value={expiry}
                  onChangeText={(v) => setExpiry(formatExpiry(v))}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>CVV</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123"
                  placeholderTextColor="#60766E"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={cvv}
                  onChangeText={(v) => setCvv(v.replace(/\D/g, ''))}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCheckout(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={canPay && !processing ? styles.confirmButton : styles.confirmDisabled}
                disabled={!canPay || processing}
                onPress={confirmPayment}
              >
                <Text style={canPay ? styles.confirmText : styles.confirmTextDisabled}>
                  {processing ? 'Processing…' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Cancel subscription modal */}
      <Modal visible={showCancel} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={{ padding: 24 }}>
              <Text style={styles.modalTitle}>Cancel Premium?</Text>
              <Text style={styles.modalSubtitle}>
                You&apos;ll lose access to unlimited recommendations, plain-language
                explanations and full history.
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCancel(false)}
                >
                  <Text style={styles.cancelText}>Keep Premium</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.dangerButton} onPress={confirmCancel}>
                  <Text style={styles.dangerText}>Cancel Plan</Text>
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

  demoNotice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#1E1705',
    borderWidth: 1,
    borderColor: '#5C4A16',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },

  demoText: { color: '#E0A33F', fontSize: 10, lineHeight: 15, flex: 1 },

  fieldLabel: { color: '#D4E6DF', fontSize: 11, marginTop: 14, marginBottom: 6 },

  input: {
    backgroundColor: '#00100B',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 13,
  },

  row: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 22 },

  cancelButton: {
    flex: 1,
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  cancelText: { color: '#fff', fontSize: 13 },

  confirmButton: {
    flex: 1,
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  confirmDisabled: {
    flex: 1,
    backgroundColor: '#123B2F',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  confirmText: { color: '#00382B', fontSize: 13, fontWeight: '600' },
  confirmTextDisabled: { color: '#3A5049', fontSize: 13, fontWeight: '600' },

  dangerButton: {
    flex: 1,
    backgroundColor: '#E0453F',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  dangerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});