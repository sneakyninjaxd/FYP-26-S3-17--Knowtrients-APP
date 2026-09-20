import { useActivities } from '@/contexts/activity-context';
import { useProfile } from '@/contexts/profile-context';
import { RANGES } from '@/src/ranges';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const GOALS = { steps: 10000, calories: 500, activeTime: 90 };

/**
 * PLACEHOLDER — the backend has no steps field, so these are sample values
 * for demonstration. Delete once a steps column exists.
 */
const SAMPLE_AVG_STEPS = 9200;
const SAMPLE_STEPS_WEEK = [5000, 4000, 6000, 5000, 7000, 10000, 6800];

/** The chart only has room for this many bars, whatever the range. */
const MAX_BARS = 7;
const CHART_HEIGHT = 150;

/** Everything is scaled to a percentage of its goal so the series stack. */
const MAX = 250;

const SERIES = [
  { key: 'steps', label: 'Steps', color: '#4ECBA0' },
  { key: 'calories', label: 'Calories Burnt', color: '#D9433F' },
  { key: 'activeTime', label: 'Active Time', color: '#7B5BD4' },
];

const pct = (value, goal) => (goal > 0 ? Math.min((value / goal) * 100, 100) : 0);

function Ring({ percent, color, radius }) {
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <Circle
      cx="70" cy="70" r={radius}
      stroke={color} strokeWidth="12" fill="none"
      strokeDasharray={`${filled} ${circumference}`}
      strokeLinecap="round"
      transform="rotate(-90 70 70)"
    />
  );
}

function Bar({ label, value, goal, unit, color, sample }) {
  return (
    <View style={styles.barBlock}>
      <View style={styles.barTop}>
        <Text style={[styles.barLabel, { color }]}>
          {label}{sample ? <Text style={styles.sampleTag}> · sample</Text> : null}
        </Text>
        <Text style={styles.barValue}>
          {value}<Text style={styles.barGoal}>/{goal} {unit}</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${pct(value, goal)}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

export default function ActivityStatistics() {
  const { profile } = useProfile();
  const { loadRange } = useActivities();

  // `plan` is client-side only — there's no subscription column yet.
  const isPremium = profile?.plan === 'premium';

  const available = useMemo(
    () => RANGES.filter((r) => !r.premium || isPremium),
    [isPremium]
  );

  const [range, setRange] = useState(available[0]);
  const [showRanges, setShowRanges] = useState(false);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRange = useCallback(
    async (r) => {
      setIsLoading(true);
      try {
        setRows(await loadRange(r.days));
      } finally {
        setIsLoading(false);
      }
    },
    [loadRange]
  );

  useFocusEffect(
    useCallback(() => {
      fetchRange(range);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchRange])
  );

  const selectRange = (r) => {
    setRange(r);
    setShowRanges(false);
    fetchRange(r);
  };

  /** Averaged across every day in the range, including days with nothing. */
  const average = useMemo(() => {
    if (!rows.length) return { steps: SAMPLE_AVG_STEPS, calories: 0, activeTime: 0 };
    const minutes = rows.reduce((s, r) => s + r.minutes, 0) / rows.length;
    const calories = rows.reduce((s, r) => s + r.calories, 0) / rows.length;
    return {
      steps: SAMPLE_AVG_STEPS,
      calories: Math.round(calories),
      activeTime: Math.round(minutes),
    };
  }, [rows]);

  const score = Math.round(
    (pct(average.steps, GOALS.steps) +
      pct(average.activeTime, GOALS.activeTime) +
      pct(average.calories, GOALS.calories)) / 3
  );

  /**
   * Each series is plotted as a percentage of its own goal, since steps,
   * minutes and kcal don't share a scale.
   */
  const chart = useMemo(() => {
    const recent = rows.slice(-MAX_BARS);
    return recent.map((r, i) => {
      const d = new Date(r.date);
      return {
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        steps: pct(SAMPLE_STEPS_WEEK[i] ?? 0, GOALS.steps),
        calories: pct(r.calories, GOALS.calories),
        activeTime: pct(r.minutes, GOALS.activeTime),
      };
    });
  }, [rows]);

  const activeDays = rows.filter((r) => r.count > 0).length;

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
        <Text style={styles.title}>Overall Activity Statistics</Text>

        {/* Average score card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.ringWrap}>
              <Svg width={140} height={140}>
                <Circle cx="70" cy="70" r="55" stroke="#123B2F" strokeWidth="12" fill="none" />
                <Circle cx="70" cy="70" r="40" stroke="#123B2F" strokeWidth="12" fill="none" />
                <Circle cx="70" cy="70" r="25" stroke="#123B2F" strokeWidth="12" fill="none" />

                <Ring percent={pct(average.steps, GOALS.steps)} color="#4ECBA0" radius={55} />
                <Ring percent={pct(average.calories, GOALS.calories)} color="#2E8B7A" radius={40} />
                <Ring percent={pct(average.activeTime, GOALS.activeTime)} color="#C77D3A" radius={25} />
              </Svg>

              <View style={styles.ringCenter}>
                <Text style={styles.ringValue}>{score}%</Text>
              </View>
            </View>

            <View style={styles.cardRight}>
              <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Average Score</Text>
              </View>

              <Bar label="Steps" value={average.steps} goal={GOALS.steps}
                   unit="steps" color="#4ECBA0" sample />
              <Bar label="Calories Burnt" value={average.calories} goal={GOALS.calories}
                   unit="kcal" color="#2E8B7A" />
              <Bar label="Active Time" value={average.activeTime} goal={GOALS.activeTime}
                   unit="mins" color="#C77D3A" />

              <Text style={styles.meta}>
                {activeDays} of {rows.length} day(s) with activity
              </Text>
            </View>
          </View>
        </View>

        {/* Stacked chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Activity Chart</Text>

          <TouchableOpacity
            style={styles.rangePicker}
            onPress={() => setShowRanges(!showRanges)}
          >
          <Text style={styles.rangeText}>{range.label}</Text>
            <Ionicons name="chevron-down" size={10} color="#00382B" />
          </TouchableOpacity>
          </View>

          {showRanges && (
            <View style={styles.rangeMenu}>
              {available.map((r) => (
            <TouchableOpacity key={r.id} onPress={() => selectRange(r)}>
            <Text style={styles.rangeOption}>{r.label}</Text>
            </TouchableOpacity>
            ))}
          </View>
            )}

          {/* Legend */}
          <View style={styles.legend}>
            {SERIES.map((s) => (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendText}>
                  {s.label}{s.key === 'steps' ? ' (sample)' : ''}
                </Text>
              </View>
            ))}
          </View>

          {isLoading && rows.length === 0 ? (
            <ActivityIndicator size="small" color="#4ECBA0" style={{ marginVertical: 60 }} />
          ) : (
            <View style={styles.chartArea}>
              {[250, 200, 150, 100, 50, 0].map((tick) => (
                <View
                  key={tick}
                  style={[styles.gridRow, { bottom: (tick / MAX) * CHART_HEIGHT + 24 }]}
                >
                  <Text style={styles.gridLabel}>{tick}</Text>
                  <View style={styles.gridLine} />
                </View>
              ))}

              <View style={styles.chartRow}>
                {chart.map((d, i) => (
                  <View key={i} style={styles.chartColumn}>
                    <View style={styles.stack}>
                      {SERIES.map((s) => (
                        <View
                          key={s.key}
                          style={{
                            height: (d[s.key] / MAX) * CHART_HEIGHT,
                            backgroundColor: s.color,
                            width: 16,
                          }}
                        />
                      ))}
                    </View>
                    <Text style={styles.chartLabel}>{d.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {range.days > MAX_BARS && (
            <Text style={styles.chartNote}>
              Showing the most recent {MAX_BARS} days; the averages above cover the full range.
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
    fontSize: 26,
    fontFamily: 'serif',
    paddingHorizontal: 25,
    marginBottom: 20,
  },

  card: {
    backgroundColor: '#07140F',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 25,
    marginBottom: 16,
  },

  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  ringWrap: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center' },
  ringCenter: { position: 'absolute' },
  ringValue: { color: '#fff', fontSize: 24, fontFamily: 'serif' },

  cardRight: { flex: 1 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  cardTitle: { color: '#fff', fontSize: 15, fontFamily: 'serif' },

  rangePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#48DDB0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  rangeText: { color: '#00382B', fontSize: 8, fontWeight: '600' },

  rangeMenu: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },

  rangeOption: { color: '#D4E6DF', fontSize: 10, paddingVertical: 5 },

  barBlock: { marginBottom: 10 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  barLabel: { fontSize: 8 },
  barValue: { color: '#D4E6DF', fontSize: 8 },
  barGoal: { color: '#60766E', fontSize: 7 },
  barTrack: { height: 4, backgroundColor: '#123B2F', borderRadius: 2 },
  barFill: { height: 4, borderRadius: 2 },

  sampleTag: { color: '#60766E', fontSize: 7, fontStyle: 'italic' },

  meta: { color: '#60766E', fontSize: 8, marginTop: 2 },

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
  },

  chartTitle: { color: '#fff', fontSize: 13 },
  chartUnit: { color: '#60766E', fontSize: 9 },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
    marginBottom: 6,
  },

  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: '#D4E6DF', fontSize: 8 },

  chartArea: { position: 'relative', height: 190 },

  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  gridLabel: { color: '#60766E', fontSize: 9, width: 22, textAlign: 'right' },
  gridLine: { flex: 1, height: 1, backgroundColor: '#123B2F' },

  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 180,
    paddingLeft: 26,
  },

  chartColumn: { alignItems: 'center' },

  stack: { flexDirection: 'column-reverse' },

  chartLabel: { color: '#60766E', fontSize: 9, marginTop: 8 },

  chartNote: { color: '#60766E', fontSize: 8, textAlign: 'center', marginTop: 10 },
});