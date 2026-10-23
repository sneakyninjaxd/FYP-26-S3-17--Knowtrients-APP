import { useAuth } from '@/contexts/auth-context';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Server statuses, styled so an answered request is obvious at a glance. */
const STATUS_STYLE = {
  resolved: { label: 'Resolved', colour: '#4ECBA0' },
  open: { label: 'Ongoing', colour: '#E0A33F' },
};

const formatWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();

  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });

  return sameDay
    ? `Today ${time}`
    : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
};

export default function HelpSupport() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);
    try {
      setRequests(await api.listSupportRequests(token));
    } catch (err) {
      setError(err?.message ?? 'Could not load your requests.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Refetch on focus so a request submitted on either form appears here.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 + insets.bottom }}>

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

        <Text style={styles.title}>Help Support</Text>
        <Text style={styles.subtitle}>Get help from us!</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/account/support-account')}
          >
            <Text style={styles.actionText}>Account Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/account/support-bug')}
          >
            <Text style={styles.actionText}>Report a bug</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Previous Requests</Text>

        {isLoading && requests.length === 0 && (
          <ActivityIndicator size="small" color="#4ECBA0" style={{ marginTop: 20 }} />
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {!isLoading && !error && requests.length === 0 && (
          <Text style={styles.empty}>
            You haven&apos;t raised any requests yet.
          </Text>
        )}

        {requests.length > 0 && (
          <View style={styles.listCard}>
            {requests.map((r, i) => {
              const status = STATUS_STYLE[r.status] ?? STATUS_STYLE.open;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.requestRow, i > 0 && styles.requestRowDivided]}
                  onPress={() => router.push(`/account/support/${r.id}`)}
                >
                  <View style={styles.requestTop}>
                    <Text style={styles.requestSubject} numberOfLines={1}>
                      {r.subject}
                    </Text>
                    <Text style={styles.requestWhen}>{formatWhen(r.created_at)}</Text>
                  </View>

                  <Text style={styles.requestBody} numberOfLines={2}>
                    {r.body}
                  </Text>

                  <View style={styles.requestFoot}>
                    <View style={[styles.statusDot, { backgroundColor: status.colour }]} />
                    <Text style={[styles.statusText, { color: status.colour }]}>
                      {status.label}
                    </Text>
                    {r.reply ? (
                      <Text style={styles.repliedTag}>· replied</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020D09' },

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
    color: '#fff',
    fontSize: 32,
    fontFamily: 'serif',
    paddingHorizontal: 25,
    paddingTop: 20,
  },

  subtitle: {
    color: '#3AA889',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 20,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 25,
    marginBottom: 24,
  },

  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2E6B57',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },

  actionText: { color: '#D4E6DF', fontSize: 12 },

  sectionLabel: {
    color: '#48DDB0',
    fontSize: 11,
    paddingHorizontal: 25,
    marginBottom: 10,
  },

  listCard: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    marginHorizontal: 25,
    overflow: 'hidden',
  },

  requestRow: { padding: 16 },

  requestRowDivided: {
    borderTopWidth: 1,
    borderTopColor: '#123B2F',
  },

  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 10,
  },

  requestSubject: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },
  requestWhen: { color: '#60766E', fontSize: 9 },

  requestBody: { color: '#60766E', fontSize: 10, lineHeight: 14, marginTop: 6 },

  requestFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },

  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '600' },
  repliedTag: { color: '#60766E', fontSize: 9 },

  error: {
    color: '#E07A5F',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 12,
  },

  empty: {
    color: '#60766E',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 40,
  },
});