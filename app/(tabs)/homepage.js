import { useAuth } from '@/contexts/auth-context';
import { useFood } from '@/contexts/food-context';
import { useProfile } from '@/contexts/profile-context';
import { api, toLogDate } from '@/services/api';
import { dailyGoals } from '@/src/goals';
import { initHealth, syncDay } from '@/src/health';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const GOALS = { steps: 10000, sleep: 8, activeTime: 90 };

/**
 * The three aspects, each backed by its own model. The prompt shows while
 * there isn't enough logged data for that model to say anything.
 */
const INSIGHT_CARDS = [
  {
    id: 'diet',
    title: 'Diet Insight',
    prompt: 'Log your meals today to see your personalised recommendation.',
  },
  {
    id: 'fitness',
    title: 'Activities Insight',
    prompt: 'Log some activity this week to see your recommendation.',
  },
  {
    id: 'sleep',
    title: 'Sleep Insight',
    prompt: 'Log a few nights to see your sleep recommendation.',
  },
];

const pct = (value, goal) => (goal > 0 ? Math.min((value / goal) * 100, 100) : 0);

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
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { profile } = useProfile();
  const { summary, loadSummary } = useFood();

  /** One entry per aspect, keyed by the ids in INSIGHT_CARDS. */
  const [recs, setRecs] = useState({});

  /** Steps from Health Connect; null until the first read completes. */
  const [health, setHealth] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadSummary(toLogDate());

      // These cards mirror the Insight tab, so a failure here is silent —
      // the card falls back to its prompt rather than showing an error.
      if (token) {
        (async () => {
          const [diet, fitness, sleep] = await Promise.allSettled([
            api.getTodaysRecommendation(token, toLogDate()),
            api.getTodaysFitnessRecommendation(token),
            api.getTodaysSleepRecommendation(token),
          ]);

          setRecs({
            diet: diet.status === 'fulfilled' ? diet.value : null,
            fitness: fitness.status === 'fulfilled' ? fitness.value : null,
            sleep: sleep.status === 'fulfilled' ? sleep.value : null,
          });
        })();
      }

      (async () => {
        // Syncs as well as reads, so a day counts even if the user never
        // opens the Activities screen.
        if ((await initHealth()) === 'ready') setHealth(await syncDay(token));
      })();
    }, [loadSummary, token])
  );

  const goals = useMemo(() => dailyGoals(profile), [profile]);

  const TODAY = {
    calories: Math.round(summary?.totals?.calories ?? 0),
    steps: health?.steps ?? 0,
    sleep: summary?.sleep_hours != null ? Math.round(summary.sleep_hours * 10) / 10 : 0,
    activeTime: Math.round(summary?.activity_minutes ?? 0),
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const completion = Math.round(
    (pct(TODAY.calories, goals.calories) +
      pct(TODAY.steps, GOALS.steps) +
      pct(TODAY.sleep, GOALS.sleep) +
      pct(TODAY.activeTime, GOALS.activeTime)) / 4
  );

  const RADIUS = 58;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const filled = (completion / 100) * CIRCUMFERENCE;

  /**
   * Each card shows its model's recommendation, the first couple of reasons
   * behind it, and the next step where the model gives one. Falls back to a
   * prompt when there isn't enough logged data yet.
   */
  const insights = INSIGHT_CARDS.map((card) => {
    const r = recs[card.id];

    if (!r) return { ...card, lines: [card.prompt] };

    const lines = [r.recommendation, ...(r.explanation ?? []).slice(0, 2)];
    if (r.next_step) lines.push(`– ${r.next_step}`);

    return { ...card, lines };
  });

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

        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>

        <Text style={styles.greeting}>
          {greeting}, {user?.first_name || 'there'}
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

              <Bar label="Calories Intake" value={TODAY.calories} goal={goals.calories}
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
        {insights.map((insight) => (
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