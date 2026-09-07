import { useFood } from '@/contexts/food-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MEAL_NAMES = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  'morning-snack': 'Morning Snack',
  'afternoon-snack': 'Afternoon Snack',
  'evening-snack': 'Evening Snack',
};

export default function MealLog() {
  const { meal } = useLocalSearchParams();
  const { entries, updateQuantity, deleteEntry } = useFood();
  const [editing, setEditing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const items = entries.filter((e) => e.meal === meal && e.date === today);
  const total = items.reduce((sum, e) => sum + e.kcalPerUnit * e.quantity, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={styles.title}>{MEAL_NAMES[meal] ?? meal}</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>

        {/* Total */}
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total intake for this Meal:</Text>
          <Text style={styles.totalValue}>
            {total}<Text style={styles.totalUnit}> kcal</Text>
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Food(s)</Text>

        {items.map((item) => (
          <View key={item.id} style={styles.foodCard}>
            <View style={styles.foodTop}>
              <View style={styles.foodInfo}>
                <Text style={styles.foodName}>{item.name}</Text>
                <Text style={styles.foodMeta}>
                  {item.kcalPerUnit} kcal for 1 {item.unit}
                </Text>
              </View>

              <View style={styles.foodRight}>
                <View style={styles.kcalPill}>
                  <Text style={styles.kcalText}>
                    {item.kcalPerUnit * item.quantity} kcal
                  </Text>
                </View>

                {editing && (
                  <TouchableOpacity onPress={() => deleteEntry(item.id)}>
                    <Ionicons name="trash-outline" size={16} color="#60766E" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.qtyRow}>
              {editing && (
                <TouchableOpacity
                  style={styles.stepper}
                  onPress={() => updateQuantity(item.id, item.quantity - 1)}
                >
                  <Text style={styles.stepperText}>−</Text>
                </TouchableOpacity>
              )}

              <View style={styles.qtyBox}>
                <Text style={styles.qtyText}>{item.quantity}</Text>
              </View>

              {editing && (
                <TouchableOpacity
                  style={styles.stepper}
                  onPress={() => updateQuantity(item.id, item.quantity + 1)}
                >
                  <Text style={styles.stepperText}>+</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.unitText}>{item.unit}</Text>
            </View>
          </View>
        ))}

        {items.length === 0 && (
          <Text style={styles.empty}>Nothing logged for this meal yet.</Text>
        )}

        {/* Add more (edit mode only) */}
        {editing && (
          <TouchableOpacity
            style={styles.addMore}
            onPress={() => router.push(`/log/foodintake/${meal}/add-search`)}
          >
            <Text style={styles.addMoreText}>+ Add more items</Text>
          </TouchableOpacity>
        )}

        {/* Edit / Save */}
        <TouchableOpacity
          style={styles.submit}
          onPress={() => setEditing(!editing)}
        >
          <Text style={styles.submitText}>{editing ? 'Save' : 'Edit'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020D09' },
  scroll: { paddingBottom: 40, flexGrow: 1 },

  title: {
    color: '#fff',
    fontSize: 32,
    fontFamily: 'serif',
    paddingHorizontal: 25,
    paddingTop: 20,
  },

  date: {
    color: '#3AA889',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 16,
  },

  totalBox: {
    backgroundColor: '#07140F',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginHorizontal: 25,
    marginBottom: 20,
  },

  totalLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  totalValue: { color: '#4ECBA0', fontSize: 24, fontFamily: 'serif' },
  totalUnit: { fontSize: 13 },

  sectionLabel: {
    color: '#48DDB0',
    fontSize: 11,
    paddingHorizontal: 25,
    marginBottom: 8,
  },

  foodCard: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 25,
    marginBottom: 10,
  },

  foodTop: { flexDirection: 'row', justifyContent: 'space-between' },
  foodInfo: { flex: 1 },
  foodName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  foodMeta: { color: '#60766E', fontSize: 9, marginTop: 2 },

  foodRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  kcalPill: {
    backgroundColor: '#0E2A20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  kcalText: { color: '#48DDB0', fontSize: 11, fontWeight: '600' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },

  stepper: { paddingHorizontal: 6 },
  stepperText: { color: '#60766E', fontSize: 16 },

  qtyBox: {
    backgroundColor: '#0E2A20',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },

  qtyText: { color: '#fff', fontSize: 12 },
  unitText: { color: '#60766E', fontSize: 10 },

  empty: {
    color: '#60766E',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 20,
  },

  addMore: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#48DDB0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 25,
    marginTop: 4,
  },

  addMoreText: { color: '#48DDB0', fontSize: 12 },

  submit: {
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 70,
    marginTop: 'auto',
  },

  submitText: { color: '#00382B', fontSize: 15, fontWeight: '600' },
});