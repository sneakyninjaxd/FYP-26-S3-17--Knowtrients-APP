import { useSleep } from '@/contexts/sleep-context';
import { useSubscription } from '@/contexts/subscription-context';
import { bucketsFor, RANGES } from '@/src/ranges';
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

/**
 * The mean of a set of clock times.
 *
 * A plain arithmetic mean is wrong here, because the clock wraps. Bedtimes
 * of 23:00 and 01:00 are two hours apart, but as minutes-since-midnight
 * they're 1380 and 60, and their average is 720 — midday, the furthest
 * possible point from the real answer of midnight.
 *
 * So each time is treated as an angle on a 24-hour circle, the sine and
 * cosine components are averaged, and the result is converted back. This is
 * the standard circular mean, the same method used for compass bearings.
 */
const meanClockMinutes = (values) => {
  if (!values.length) return null;

  const TWO_PI = Math.PI * 2;
  let sin = 0;
  let cos = 0;

  for (const v of values) {
    const angle = (v / 1440) * TWO_PI;
    sin += Math.sin(angle);
    cos += Math.cos(angle);
  }

  // Both components near zero means the times are spread evenly around the
  // clock, so no average is meaningful — 3am and 3pm have no midpoint.
  if (Math.abs(sin) < 1e-9 && Math.abs(cos) < 1e-9) return null;

  const mean = Math.atan2(sin / values.length, cos / values.length);
  return ((mean / TWO_PI) * 1440 + 1440) % 1440;
};

export default function SleepStatistics() {
  const { sleepLogs, isLoading, loadSleep } = useSleep();

  // Read from the subscriptions table rather than a client-side flag.
  const { isPremium } = useSubscription();

  const available = useMemo(
    () => RANGES.filter((r) => !r.premium || isPremium),
    [isPremium]
  );

  const [range, setRange] = useState(available[0]);
  const [showRange, setShowRange] = useState(false);

  /** Changing the range refetches — the server accepts up to 365 days. */
  const selectRange = (r) => {
    setRange(r);
    setShowRange(false);
    loadSleep(r.days);
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

    const mins = meanClockMinutes(values);
    if (mins === null) return '--';

    let h = Math.floor(mins / 60);
    let m = Math.round(mins % 60);

    // Rounding 59.6 minutes up has to carry into the hour.
    if (m === 60) {
      m = 0;
      h = (h + 1) % 24;
    }

    // A colon, not a dot — "1.33am" reads as a decimal number.
    return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
  };

  /**
   * One bar per night for a week, per week for a month, per month for a year.
   *
   * A bucket's value is the mean of the nights actually logged in it, not of
   * every date it covers — a week with two nights recorded should read as how
   * those nights went, not be halved by five blanks.
   */
  const chart = useMemo(() => {
    const byDate = new Map(sleepLogs.map((s) => [s.log_date, s]));

    return bucketsFor(range.days).map((bucket) => {
      const hours = bucket.keys
        .map((k) => byDate.get(k)?.hours)
        .filter((h) => typeof h === 'number' && h > 0);

      return {
        label: bucket.label,
        sub: bucket.sub,
        nights: hours.length,
        value: hours.length
          ? hours.reduce((sum, h) => sum + h, 0) / hours.length
          : 0,
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
                // +35 clears the two label lines beneath each bar.
                <View key={tick} style={[styles.gridRow, { bottom: (tick / MAX_HOURS) * 140 + 35 }]}>
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
                        {
                          height: Math.min(d.value / MAX_HOURS, 1) * 140,
                          // 12 monthly bars won't fit at the weekly width.
                          width: chart.length > 7 ? 10 : 18,
                        },
                      ]}
                    />
                    <Text style={styles.chartLabel}>{d.label}</Text>
                    <Text style={styles.chartSub}>{d.sub}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!isLoading && sleepLogs.length === 0 && (
            <Text style={styles.empty}>No sleep logged yet.</Text>
          )}

          {/* Says what a bar is, since it stops being one night. */}
          {range.days > 7 && sleepLogs.length > 0 && (
            <Text style={styles.chartNote}>
              Each bar is the average of the nights logged in that
              {range.days > 92 ? ' month' : ' week'}.
            </Text>
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
    paddingTop: 20,
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

  chartArea: { position: 'relative', height: 192, marginTop: 12 },

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
    height: 182,
    paddingLeft: 22,
  },

  chartColumn: { alignItems: 'center' },

  chartBar: { backgroundColor: '#4ECBA0', borderRadius: 9 },

  chartLabel: { color: '#60766E', fontSize: 10, marginTop: 8 },

  // The date or year beneath the label, dimmer so the label reads first.
  chartSub: { color: '#3A5049', fontSize: 8, marginTop: 1 },

  empty: {
    color: '#60766E',
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 30,
  },

  chartNote: {
    color: '#60766E',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 10,
  },
});