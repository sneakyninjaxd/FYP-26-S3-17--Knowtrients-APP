import { useProfile } from '@/contexts/profile-context';
import { useSleep } from '@/contexts/sleep-context';
import { RANGES } from '@/src/ranges';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAX_HOURS = 10;

/** "HH:MM" → minutes since midnight, or null if absent/malformed. */
const timeToMinutes = (value) => {
  if (typeof value !== 'string') return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

export default function SleepStatistics() {
  const { sleepLogs, isLoading, loadSleep } = useSleep();
  const { profile } = useProfile();

  // `plan` is client-side only — there's no subscription column yet.
  const isPremium = profile?.plan === 'premium';

  const available = useMemo(
    () => RANGES.filter((r) => !r.premium || isPremium),
    [isPremium]
  );

  const [range, setRange] = useState(available[0]);
  const [showRange, setShowRange] = useState(false);

  /** Changing the range refetches — the server caps `days` at 90. */
  const selectRange = (r) => {
    setRange(r);
    setShowRange(false);
    loadSleep(Math.min(r.days, 90));
  };

  // average duration; `hours` is a single decimal, not an h/m pair
  const avgMinutes = useMemo(() => {
    if (!sleepLogs.length) return 0;
    const total = sleepLogs.reduce((sum, s) => sum + (s.hours ?? 0) * 60, 0);
    return total / sleepLogs.length;
  }, [sleepLogs]);

  const avgHours = Math.floor(avgMinutes / 60);
  const avgMins = Math.round(avgMinutes % 60);

  /**
   * Average bedtime or wake time. Both are optional on the API, so logs
   * without them are skipped rather than crashing the average.
   */
  const avgTime = (field) => {
    const values = sleepLogs
      .map((s) => timeToMinutes(s[field]))
      .filter((v) => v !== null);

    if (!values.length) return '--';

    const mins = values.reduce((sum, v) => sum + v, 0) / values.length;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h % 12 || 12}.${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
  };

  // chart data for the selected range
  const chart = useMemo(() => {
    const span = Math.min(range.days, 7);
    return Array.from({ length: span }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (span - 1 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const log = sleepLogs.find((s) => s.log_date === key);

      return {
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        value: log?.hours ?? 0,
      };
    });
  }, [sleepLogs, range]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

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

        <Text style={styles.title}>Overall Sleep Statistics</Text>

        {/* Average duration */}
        <View style={styles.avgCard}>
          <Text style={styles.avgTitle}>Average Sleep Duration</Text>
          <Text style={styles.avgValue}>
            {sleepLogs.length
              ? `${String(avgHours).padStart(2, '0')}h ${String(avgMins).padStart(2, '0')}m`
              : '--h --m'}
          </Text>
          <Text style={styles.avgHelper}>
            This measures the average amount of time you sleep based on all your
            recorded sleep sessions.
          </Text>
        </View>

        {/* Duration chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Sleep Duration</Text>

            <TouchableOpacity
              style={styles.rangePicker}
              onPress={() => setShowRange(!showRange)}
            >
              <Text style={styles.rangeText}>{range.label}</Text>
              <Ionicons name="chevron-down" size={12} color="#00382B" />
            </TouchableOpacity>
          </View>

          {showRange && (
            <View style={styles.rangeMenu}>
              {available.map((r) => (
                <TouchableOpacity key={r.id} onPress={() => selectRange(r)}>
                  <Text style={styles.rangeOption}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.avgLine}>Average bedtime: {avgTime('bedtime')}</Text>
          <Text style={styles.avgLine}>Average wake-up time: {avgTime('wake_time')}</Text>

          {isLoading && sleepLogs.length === 0 ? (
            <ActivityIndicator size="small" color="#4ECBA0" style={{ marginVertical: 40 }} />
          ) : (
            <View style={styles.chartArea}>
              {[10, 8, 6, 4, 2, 0].map((tick) => (
                <View key={tick} style={[styles.gridRow, { bottom: (tick / MAX_HOURS) * 140 + 24 }]}>
                  <Text style={styles.gridLabel}>{tick}</Text>
                  <View style={styles.gridLine} />
                </View>
              ))}

              <View style={styles.chartRow}>
                {chart.map((d, i) => (
                  <View key={i} style={styles.chartColumn}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: Math.min(d.value / MAX_HOURS, 1) * 140 },
                      ]}
                    />
                    <Text style={styles.chartLabel}>{d.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!isLoading && sleepLogs.length === 0 && (
            <Text style={styles.empty}>No sleep logged yet.</Text>
          )}
        </View>

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
    fontSize: 30,
    fontFamily: 'serif',
    paddingHorizontal: 25,
    marginBottom: 20,
  },

  avgCard: {
    backgroundColor: '#07140F',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 25,
    marginBottom: 20,
  },

  avgTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },

  avgValue: {
    color: '#4ECBA0',
    fontSize: 32,
    fontFamily: 'serif',
    marginTop: 8,
    marginBottom: 10,
  },

  avgHelper: { color: '#60766E', fontSize: 9, lineHeight: 13 },

  chartCard: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 25,
  },

  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  chartTitle: { color: '#fff', fontSize: 14 },

  rangePicker: {
    backgroundColor: '#48DDB0',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  rangeText: { color: '#00382B', fontSize: 10, fontWeight: '600' },

  rangeMenu: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },

  rangeOption: { color: '#D4E6DF', fontSize: 11, paddingVertical: 6 },

  avgLine: { color: '#48DDB0', fontSize: 10, marginBottom: 2 },

  chartArea: { position: 'relative', height: 180, marginTop: 12 },

  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  gridLabel: { color: '#60766E', fontSize: 10, width: 16, textAlign: 'right' },
  gridLine: { flex: 1, height: 1, backgroundColor: '#123B2F' },

  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 170,
    paddingLeft: 22,
  },

  chartColumn: { alignItems: 'center' },

  chartBar: { width: 18, backgroundColor: '#4ECBA0', borderRadius: 9 },

  chartLabel: { color: '#60766E', fontSize: 10, marginTop: 8 },

  empty: {
    color: '#60766E',
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 30,
  },
});