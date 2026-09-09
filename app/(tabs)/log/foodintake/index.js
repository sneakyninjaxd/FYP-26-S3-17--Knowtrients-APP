import { useFood } from '@/contexts/food-context';
import { router } from 'expo-router';
import {
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

export default function FoodLog() {
  const { entries } = useFood();

  const today = new Date().toISOString().split('T')[0];
  const todayEntries = entries.filter((e) => e.date === today);

  const statsFor = (mealId) => {
    const mealEntries = todayEntries.filter((e) => e.meal === mealId);
    return {
      items: mealEntries.length,
      calories: mealEntries.reduce(
        (sum, e) => sum + e.kcalPerUnit * e.quantity, 0
      ),
    };
  };

  const totalCalories = todayEntries.reduce(
    (sum, e) => sum + e.kcalPerUnit * e.quantity, 0
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
        </View>
        <View style={styles.divider} />

        <Text style={styles.title}>Food Log</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>

        {/* Diet quality score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <View>
              <Text style={styles.scoreTitle}>Diet Quality Score</Text>
              <Text style={styles.scoreValue}>
                78<Text style={styles.scoreMax}>/100</Text>
              </Text>
            </View>

            <View style={styles.scoreBars}>
              <Bar label="Calories Intake" value={totalCalories} goal={3000} unit="kcal" color="#4ECBA0" />
              <Bar label="Sugar" value={41} goal={50} unit="g" color="#A05BD4" />
              <Bar label="Sodium" value={4.5} goal={6} unit="mg" color="#D9433F" />
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
        {MEALS.map((meal) => {
          const stats = statsFor(meal.id);

          return (
            <TouchableOpacity
              key={meal.id}
              style={styles.mealRow}
              onPress={() => router.push(`/log/foodintake/${meal.id}`)}
            >
              <View>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealItems}>{stats.items} item(s)</Text>
              </View>

              <View style={styles.mealRight}>
                <View style={styles.caloriePill}>
                  <Text style={styles.calorieValue}>{stats.calories}</Text>
                  <Text style={styles.calorieUnit}>kcal</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}

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

  scoreTitle: { color: '#fff', fontSize: 14, fontFamily: 'serif' },

  scoreValue: { color: '#4ECBA0', fontSize: 32, fontFamily: 'serif', marginTop: 8 },
  scoreMax: { fontSize: 16, color: '#fff' },

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