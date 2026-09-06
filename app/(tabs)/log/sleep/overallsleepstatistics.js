import { useSleep } from '@/contexts/sleep-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAX_HOURS = 10;
const RANGES = [
  { id: 'week', label: 'Over past week', days: 7 },
  { id: 'month', label: 'Over past month', days: 30 },
];

export default function SleepStatistics() {
  const { sleepLogs } = useSleep();
  const [range, setRange] = useState(RANGES[0]);
  const [showRange, setShowRange] = useState(false);

  // average duration across all logs
  const totalMinutes = sleepLogs.reduce(
    (sum, s) => sum + s.hours * 60 + s.minutes,
    0
  );
  const avgMinutes = sleepLogs.length ? totalMinutes / sleepLogs.length : 0;
  const avgHours = Math.floor(avgMinutes / 60);
  const avgMins = Math.round(avgMinutes % 60);

  // average bedtime and wake time
  const avgTime = (field) => {
    if (!sleepLogs.length) return '--';
    const mins = sleepLogs.reduce((sum, s) => {
      const [h, m] = s[field].split(':').map(Number);
      return sum + h * 60 + m;
    }, 0) / sleepLogs.length;

    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h % 12 || 12}.${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
  };

  // chart data for the selected range
  const chart = Array.from({ length: Math.min(range.days, 7) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const log = sleepLogs.find((s) => s.date === key);

    return {
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      value: log ? log.hours + log.minutes / 60 : 0,
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>

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
              {RANGES.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => {
                    setRange(r);
                    setShowRange(false);
                  }}
                >
                  <Text style={styles.rangeOption}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.avgLine}>Average bedtime: {avgTime('sleepTime')}</Text>
          <Text style={styles.avgLine}>Average wake-up time: {avgTime('wakeTime')}</Text>

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
    paddingVertical: 20,
  },

  logo: { color: '#fff', fontSize: 20, fontFamily: 'serif' },

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
});