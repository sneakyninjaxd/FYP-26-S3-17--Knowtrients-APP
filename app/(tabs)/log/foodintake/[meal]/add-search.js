import { useFood } from '@/contexts/food-context';
import { FOODS, searchFoods } from '@/src/food';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const TABS = ['All Items', 'My Favourites'];

export default function AddFood() {
  const { meal } = useLocalSearchParams();
  const { entries, addEntry, favourites, toggleFavourite } = useFood();

  const [query, setQuery] = useState('');
    const [tab, setTab] = useState('All Items');

  const searching = query.trim().length > 0;

  const loggedIds = [...new Set(entries.map((e) => e.foodId).reverse())];
  const logged = loggedIds
    .map((id) => FOODS.find((f) => f.id === id))
    .filter(Boolean);

  const results = searching
    ? searchFoods(query)
    : tab === 'My Favourites'
      ? FOODS.filter((f) => favourites.includes(f.id))
      : FOODS;
  const handleAdd = (food) => {
    addEntry({
      date: new Date().toISOString().split('T')[0],
      meal,
      foodId: food.id,
      name: food.name,
      kcalPerUnit: food.kcal,
      unit: food.unit,
      quantity: 1,
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <Text style={styles.title}>{MEAL_NAMES[meal] ?? meal}</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>

        {/* Search */}
        <View style={[styles.searchBox, searching && styles.searchBoxActive]}>
          <Ionicons name="search" size={16} color={searching ? '#48DDB0' : '#60766E'} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search food or drink..."
            placeholderTextColor="#60766E"
            value={query}
            onChangeText={setQuery}
          />
          {searching && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color="#60766E" />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs, hidden while searching */}
        {!searching && (
          <View style={styles.tabRow}>
            {TABS.map((t) => {
              const active = tab === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={styles.tab}
                  onPress={() => setTab(t)}
                >
                  <Text style={active ? styles.tabTextActive : styles.tabText}>{t}</Text>
                  <View style={active ? styles.tabLineActive : styles.tabLine} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {searching && (
          <Text style={styles.resultCount}>
            {results.length} result(s) found
          </Text>
        )}

        {!searching && (
          <Text style={styles.sectionLabel}>
            {tab === 'My Favourites' ? 'My Favourite(s)' : 'All Items'}
          </Text>
        )}

        {/* Results */}
        {results.map((food) => (
          <View key={food.id} style={styles.foodRow}>
            <TouchableOpacity onPress={() => toggleFavourite(food.id)}>
              <Ionicons
                name={favourites.includes(food.id) ? 'star' : 'star-outline'}
                size={16}
                color="#48DDB0"
              />
            </TouchableOpacity>

            <View style={styles.foodInfo}>
              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.foodMeta}>
                {food.kcal} kcal for 1 {food.unit}
              </Text>
            </View>

            <TouchableOpacity onPress={() => handleAdd(food)}>
              <Ionicons name="add-circle-outline" size={22} color="#48DDB0" />
            </TouchableOpacity>
          </View>
        ))}

        {results.length === 0 && (
          <Text style={styles.empty}>
            {searching ? 'No matches found.' : 'Nothing here yet.'}
          </Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020D09' },

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

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 25,
  },

  searchBoxActive: { borderColor: '#48DDB0' },

  searchInput: { flex: 1, color: '#fff', fontSize: 12, padding: 0 },

  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginTop: 20,
    marginBottom: 16,
  },

  tab: { alignItems: 'center' },

  tabText: { color: '#60766E', fontSize: 11, marginBottom: 6 },
  tabTextActive: { color: '#48DDB0', fontSize: 11, marginBottom: 6 },

  tabLine: { height: 2, width: 90, backgroundColor: '#123B2F' },
  tabLineActive: { height: 2, width: 90, backgroundColor: '#48DDB0' },

  resultCount: {
    color: '#60766E',
    fontSize: 10,
    paddingHorizontal: 25,
    marginTop: 12,
    marginBottom: 8,
  },

  sectionLabel: {
    color: '#48DDB0',
    fontSize: 11,
    paddingHorizontal: 25,
    marginBottom: 8,
  },

  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 25,
    marginBottom: 10,
  },

  foodInfo: { flex: 1 },
  foodName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  foodMeta: { color: '#60766E', fontSize: 9, marginTop: 2 },

  empty: {
    color: '#60766E',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 20,
  },
});