import { useFood } from '@/contexts/food-context';
import { useProfile } from '@/contexts/profile-context';
import { dailyGoals } from '@/src/goals';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MEALS = [
  { id: 'breakfast',       name: 'Breakfast' },
  { id: 'lunch',           name: 'Lunch' },
  { id: 'dinner',          name: 'Dinner' },
  { id: 'morning-snack',   name: 'Morning Snack' },
  { id: 'afternoon-snack', name: 'Afternoon Snack' },
  { id: 'evening-snack',   name: 'Evening Snack' },
];

const pct = (value, goal) => (goal > 0 ? Math.min((value / goal) * 100, 100) : 0);

function Bar({ label, value, goal, unit, color }) {
  const over = value > goal;
  return (
    <View style={styles.barBlock}>
      <View style={styles.barTop}>
        <Text style={[styles.barLabel, { color }]}>{label}</Text>
        <Text style={styles.barValue}>
          {value}
          <Text style={styles.barGoal}>/{goal} {unit}</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${pct(value, goal)}%`, backgroundColor: over ? '#D9433F' : color },
          ]}
        />
      </View>
    </View>
  );
}

export default function FoodLog() {
  const { summary, isLoading, loadSummary } = useFood();
  const { profile } = useProfile();

  // Refetch on focus so returning from the add screen shows the new entry.
  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  const goals = useMemo(() => dailyGoals(profile), [profile]);

  const totals = summary?.totals;

  /** The API returns only meals that have entries, so fill in the rest as zero. */
  const mealStats = useMemo(() => {
    const byType = new Map((summary?.meals ?? []).map((m) => [m.meal_type, m]));
    return MEALS.map((meal) => {
      const row = byType.get(meal.id);
      return {
        ...meal,
        items: row?.item_count ?? 0,
        calories: Math.round(row?.calories ?? 0),
      };
    });
  }, [summary]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>

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
        <Text style={styles.title}>Food Log</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>

        {/* Today's intake */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <View style={styles.calorieBlock}>
              <Text style={styles.scoreTitle}>Today&apos;s Intake</Text>
              {isLoading && !totals ? (
                <ActivityIndicator size="small" color="#4ECBA0" style={{ marginTop: 12 }} />
              ) : (
                <Text style={styles.scoreValue}>
                  {Math.round(totals?.calories ?? 0)}
                  <Text style={styles.scoreMax}>/{goals.calories}</Text>
                </Text>
              )}
              <Text style={styles.scoreUnit}>kcal</Text>
            </View>

            <View style={styles.scoreBars}>
              <Bar
                label="Calories Intake"
                value={Math.round(totals?.calories ?? 0)}
                goal={goals.calories}
                unit="kcal"
                color="#4ECBA0"
              />
              <Bar
                label="Sugar"
                value={Math.round(totals?.sugar_g ?? 0)}
                goal={goals.sugar_g}
                unit="g"
                color="#A05BD4"
              />
              <Bar
                label="Sodium"
                value={Math.round(totals?.sodium_mg ?? 0)}
                goal={goals.sodium_mg}
                unit="mg"
                color="#D9433F"
              />
            </View>
          </View>

          <Text
            style={styles.moreLink}
            onPress={() => router.push('/log/foodintake/nutrition')}
          >
            More Nutritional Information ›
          </Text>
        </View>

        {/* Meal rows */}
        {mealStats.map((meal) => (
          <TouchableOpacity
            key={meal.id}
            style={styles.mealRow}
            onPress={() => router.push(`/log/foodintake/${meal.id}`)}
          >
            <View>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealItems}>{meal.items} item(s)</Text>
            </View>

            <View style={styles.mealRight}>
              <View style={styles.caloriePill}>
                <Text style={styles.calorieValue}>{meal.calories}</Text>
                <Text style={styles.calorieUnit}>kcal</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
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
  divider: { height: 1, backgroundColor: '#123B2F' },

  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'serif',
    paddingHorizontal: 25,
    paddingTop: 20,
  },

  date: {
    color: '#48DDB0',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 16,
  },

  scoreCard: {
    backgroundColor: '#07140F',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 25,
    marginBottom: 20,
  },

  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },

  calorieBlock: { minWidth: 96 },

  scoreTitle: { color: '#fff', fontSize: 14, fontFamily: 'serif' },

  scoreValue: { color: '#4ECBA0', fontSize: 28, fontFamily: 'serif', marginTop: 8 },
  scoreMax: { fontSize: 14, color: '#fff' },
  scoreUnit: { color: '#60766E', fontSize: 9, marginTop: 2 },

  scoreBars: { flex: 1 },

  moreLink: {
    color: '#60766E',
    fontSize: 9,
    textAlign: 'right',
    marginTop: 12,
  },

  barBlock: { marginBottom: 8 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  barLabel: { fontSize: 8 },
  barValue: { color: '#D4E6DF', fontSize: 8 },
  barGoal: { color: '#60766E', fontSize: 7 },
  barTrack: { height: 4, backgroundColor: '#123B2F', borderRadius: 2 },
  barFill: { height: 4, borderRadius: 2 },

  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 25,
    marginBottom: 10,
  },

  mealName: { color: '#D4E6DF', fontSize: 13 },
  mealItems: { color: '#60766E', fontSize: 10, marginTop: 2 },

  mealRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  caloriePill: {
    backgroundColor: '#0E2A20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },

  calorieValue: { color: '#48DDB0', fontSize: 13, fontWeight: '600' },
  calorieUnit: { color: '#3AA889', fontSize: 8 },

  chevron: { color: '#60766E', fontSize: 18 },
});