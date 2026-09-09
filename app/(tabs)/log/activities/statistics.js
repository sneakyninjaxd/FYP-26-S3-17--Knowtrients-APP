import { useProfile } from '@/contexts/profile-context';
import { RANGES } from '@/src/ranges';
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
import Svg, { Circle } from 'react-native-svg';

const GOALS = { steps: 10000, calories: 2500, activeTime: 90 };
const AVERAGE = { steps: 9200, calories: 2100, activeTime: 78 };

// stacked chart data — one entry per day
const CHART = [
  { label: 'Mon', steps: 60, calories: 45, activeTime: 30 },
  { label: 'Tue', steps: 80, calories: 55, activeTime: 40 },
  { label: 'Wed', steps: 70, calories: 60, activeTime: 35 },
  { label: 'Thu', steps: 90, calories: 50, activeTime: 45 },
  { label: 'Fri', steps: 100, calories: 70, activeTime: 50 },
  { label: 'Sat', steps: 85, calories: 65, activeTime: 42 },
  { label: 'Sun', steps: 95, calories: 80, activeTime: 55 },
];

const SERIES = [
  { key: 'steps', label: 'Steps', color: '#4ECBA0' },
  { key: 'calories', label: 'Calories Burnt', color: '#D9433F' },
  { key: 'activeTime', label: 'Active Time', color: '#7B5BD4' },
];

const MAX = 250;
const CHART_HEIGHT = 150;

const pct = (value, goal) => Math.min((value / goal) * 100, 100);

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

function Bar({ label, value, goal, unit, color }) {
  return (
    <View style={styles.barBlock}>
      <View style={styles.barTop}>
        <Text style={[styles.barLabel, { color }]}>{label}</Text>
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
  const isPremium = profile.plan === 'premium';

  const available = RANGES.filter((r) => !r.premium || isPremium);

  const [range, setRange] = useState(available[0]);
  const [showRanges, setShowRanges] = useState(false);

  const score = Math.round(
    (pct(AVERAGE.steps, GOALS.steps) +
      pct(AVERAGE.calories, GOALS.calories) +
      pct(AVERAGE.activeTime, GOALS.activeTime)) / 3
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Overall Activity Statistics</Text>

        {/* Average score card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.ringWrap}>
              <Svg width={140} height={140}>
                <Circle cx="70" cy="70" r="55" stroke="#123B2F" strokeWidth="12" fill="none" />
                <Circle cx="70" cy="70" r="40" stroke="#123B2F" strokeWidth="12" fill="none" />
                <Circle cx="70" cy="70" r="25" stroke="#123B2F" strokeWidth="12" fill="none" />

                <Ring percent={pct(AVERAGE.steps, GOALS.steps)} color="#4ECBA0" radius={55} />
                <Ring percent={pct(AVERAGE.calories, GOALS.calories)} color="#2E8B7A" radius={40} />
                <Ring percent={pct(AVERAGE.activeTime, GOALS.activeTime)} color="#C77D3A" radius={25} />
              </Svg>

              <View style={styles.ringCenter}>
                <Text style={styles.ringValue}>{score}%</Text>
              </View>
            </View>

            <View style={styles.cardRight}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Average Score</Text>

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
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => {
                        setRange(r);
                        setShowRanges(false);
                      }}
                    >
                      <Text style={styles.rangeOption}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Bar label="Steps" value={AVERAGE.steps} goal={GOALS.steps}
                   unit="steps" color="#4ECBA0" />
              <Bar label="Calories Burnt" value={AVERAGE.calories} goal={GOALS.calories}
                   unit="kcal" color="#2E8B7A" />
              <Bar label="Active Time" value={AVERAGE.activeTime} goal={GOALS.activeTime}
                   unit="mins" color="#C77D3A" />
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

          {/* Legend */}
          <View style={styles.legend}>
            {SERIES.map((s) => (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendText}>{s.label}</Text>
              </View>
            ))}
          </View>

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
              {CHART.map((d) => (
                <View key={d.label} style={styles.chartColumn}>
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
});