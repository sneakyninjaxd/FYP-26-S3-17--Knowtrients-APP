import { useActivities } from '@/contexts/activity-context';
import { useFood } from '@/contexts/food-context';
import { useProfile } from '@/contexts/profile-context';
import { useSleep } from '@/contexts/sleep-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const GOALS = {
  calories: 3000,
  steps: 10000,
  sleep: 8,
  activeTime: 90,
};

const HOME_INSIGHTS = [
  {
    id: 'diet',
    title: 'Diet Insight',
    lines: [
      'Take in another 700 kcal to complete your calorie intake for today !',
      '– Chicken and Rice: One large grilled chicken breast with one cup of pilaf rice and mixed vegetables.',
      '– Salmon Plate: One baked salmon fillet with one cup of white or brown rice and one cup of steamed broccoli.',
    ],
  },
  {
    id: 'activity',
    title: 'Activities Insight',
    lines: [
      'Walk another 3000 steps to reach your daily goal!',
      '–Take a walk in the park',
      '–Cycle for another 30 mins to lose ~100kcal',
    ],
  },
];

const pct = (value, goal) => Math.min((value / goal) * 100, 100);

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

export default function Homepage() {
  const { profile } = useProfile();
  const { entries } = useFood();
  const { activities } = useActivities();
  const { sleepLogs } = useSleep();

  const today = new Date().toISOString().split('T')[0];

  const calories = entries
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + e.kcalPerUnit * e.quantity, 0);

  const activeTime = activities
    .filter((a) => a.date === today)
    .reduce((sum, a) => sum + (parseInt(a.duration) || 0), 0);

  const sleepLog = sleepLogs.find((s) => s.date === today);
  const sleep = sleepLog
    ? Math.round((sleepLog.hours + sleepLog.minutes / 60) * 10) / 10
    : 0;

  const TODAY = { calories, steps: 0, sleep, activeTime };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const completion = Math.round(
    (pct(TODAY.calories, GOALS.calories) +
      pct(TODAY.steps, GOALS.steps) +
      pct(TODAY.sleep, GOALS.sleep) +
      pct(TODAY.activeTime, GOALS.activeTime)) / 4
  );

  const RADIUS = 58;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const filled = (completion / 100) * CIRCUMFERENCE;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />

        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>

        <Text style={styles.greeting}>
          {greeting}, {profile.firstName || 'User'}
        </Text>

        {/* Daily goals card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.ringWrap}>
              <Svg width={140} height={140}>
                <Circle
                  cx="70" cy="70" r={RADIUS}
                  stroke="#123B2F" strokeWidth="16" fill="none"
                />
                <Circle
                  cx="70" cy="70" r={RADIUS}
                  stroke="#4ECBA0" strokeWidth="16" fill="none"
                  strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
                  strokeLinecap="round"
                  transform="rotate(-90 70 70)"
                />
              </Svg>

              <View style={styles.ringCenter}>
                <Text style={styles.ringValue}>{completion}%</Text>
                <Text style={styles.ringLabel}>Completed</Text>
              </View>
            </View>

            <View style={styles.cardRight}>
              <Text style={styles.cardTitle}>Daily Goals</Text>

              <Bar label="Calories Intake" value={TODAY.calories} goal={GOALS.calories}
                   unit="kcal" color="#48DDB0" />
              <Bar label="Steps" value={TODAY.steps} goal={GOALS.steps}
                   unit="steps" color="#3A9BD9" />
              <Bar label="Sleep Hours" value={TODAY.sleep} goal={GOALS.sleep}
                   unit="hours" color="#A05BD4" />
              <Bar label="Active Time" value={TODAY.activeTime} goal={GOALS.activeTime}
                   unit="mins" color="#D9873A" />
            </View>
          </View>
        </View>

        {/* Insight cards */}
        {HOME_INSIGHTS.map((insight) => (
          <View key={insight.id} style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <Ionicons name="bulb-outline" size={14} color="#48DDB0" />
              <Text style={styles.insightTitle}>{insight.title}</Text>
            </View>

            {insight.lines.map((line, i) => (
              <Text key={i} style={styles.insightLine}>{line}</Text>
            ))}

            <TouchableOpacity onPress={() => router.push('/insight')}>
              <Text style={styles.viewMore}>View More ⌄</Text>
            </TouchableOpacity>
          </View>
        ))}

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
  divider: { height: 1, backgroundColor: '#123B2F' },

  date: {
    color: '#48DDB0',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 18,
    marginBottom: 4,
  },

  greeting: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'serif',
    paddingHorizontal: 25,
    marginBottom: 16,
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

  ringCenter: { position: 'absolute', alignItems: 'center' },

  ringValue: { color: '#fff', fontSize: 26, fontFamily: 'serif' },
  ringLabel: { color: '#D4E6DF', fontSize: 10 },

  cardRight: { flex: 1 },

  cardTitle: { color: '#fff', fontSize: 16, fontFamily: 'serif', marginBottom: 12 },

  barBlock: { marginBottom: 10 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  barLabel: { fontSize: 8 },
  barValue: { color: '#D4E6DF', fontSize: 8 },
  barGoal: { color: '#60766E', fontSize: 7 },
  barTrack: { height: 4, backgroundColor: '#123B2F', borderRadius: 2 },
  barFill: { height: 4, borderRadius: 2 },

  insightCard: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },

  insightTitle: { color: '#48DDB0', fontSize: 13, fontWeight: '600' },

  insightLine: { color: '#D4E6DF', fontSize: 10, lineHeight: 16 },

  viewMore: {
    color: '#48DDB0',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 12,
  },
});