import { useFood } from '@/contexts/food-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

const TABS = ['Recent', 'My Favourites'];

export default function AddFood() {
  const { meal } = useLocalSearchParams();
  const {
    entries,
    addEntry,
    searchFoods,
    favourites,
    isFavourite,
    toggleFavourite,
  } = useFood();

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('Recent');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [addingId, setAddingId] = useState(null);

  const searching = query.trim().length > 0;

  /** Guards against an earlier request resolving after a later one. */
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const id = ++requestId.current;
    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const data = await searchFoods(q);
        console.log('search returned', JSON.stringify(data).slice(0, 300));
        if (id !== requestId.current) return;   // a newer keystroke won
        setResults(data);
      } catch (err) {
        if (id !== requestId.current) return;
        setSearchError(err?.message ?? 'Search failed.');
        setResults([]);
      } finally {
        if (id === requestId.current) setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchFoods]);

  /**
   * Log rows aren't catalogue foods — they have no id to favourite and their
   * calories are already scaled to the portion. Shaped here so one row
   * component can render both, with `log` marking the difference.
   */
  const recent = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const e of [...entries].reverse()) {
      if (seen.has(e.food_name)) continue;
      seen.add(e.food_name);
      out.push({
        key: `log-${e.id}`,
        name: e.food_name,
        calories: e.calories,
        unit: e.unit,
        quantity: e.quantity,
        log: e,
      });
      if (out.length >= 15) break;
    }
    return out;
  }, [entries]);

  const favouriteItems = useMemo(
    () =>
      favourites.map((f) => ({
        key: `fav-${f.id}`,
        name: f.name,
        calories: f.calories,
        unit: f.serving_description ?? 'serving',
        quantity: 1,
        food: f,
      })),
    [favourites]
  );

  const searchItems = useMemo(
    () =>
      results.map((f) => ({
        key: `food-${f.id}`,
        name: f.name,
        brand: f.brand,
        calories: f.calories,
        unit: f.serving_description ?? 'serving',
        quantity: 1,
        food: f,
      })),
    [results]
  );

  const items = searching
    ? searchItems
    : tab === 'My Favourites'
      ? favouriteItems
      : recent;

  const handleAdd = async (item) => {
    console.log('tapped', item.key, 'has food?', !!item.food);
    setAddingId(item.key);
    try {
      if (item.food) {
        await addEntry({ meal, food: item.food, quantity: 1 });
      } else {
        // Re-logging a previous entry: copy its values as a custom entry,
        // since the catalogue id isn't stored on the log row.
        const l = item.log;
        await addEntry({
          meal,
          custom: {
            name: l.food_name,
            unit: l.unit,
            quantity: l.quantity,
            nutrition: {
              calories: l.calories,
              protein_g: l.protein_g,
              carbs_g: l.carbs_g,
              fat_g: l.fat_g,
              saturated_fat_g: l.saturated_fat_g,
              fiber_g: l.fiber_g,
              sugar_g: l.sugar_g,
              sodium_mg: l.sodium_mg,
              vegetable_servings: l.vegetable_servings,
            },
          },
        });
      }
      router.back();
    } finally {
      setAddingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

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
            autoCorrect={false}
            returnKeyType="search"
          />
          {isSearching && <ActivityIndicator size="small" color="#48DDB0" />}
          {searching && !isSearching && (
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
                <TouchableOpacity key={t} style={styles.tab} onPress={() => setTab(t)}>
                  <Text style={active ? styles.tabTextActive : styles.tabText}>{t}</Text>
                  <View style={active ? styles.tabLineActive : styles.tabLine} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {searching && !isSearching && !searchError && (
          <Text style={styles.resultCount}>{items.length} result(s) found</Text>
        )}

        {searchError && <Text style={styles.error}>{searchError}</Text>}

        {!searching && (
          <Text style={styles.sectionLabel}>
            {tab === 'My Favourites' ? 'My Favourite(s)' : 'Recently Logged'}
          </Text>
        )}

        {/* Results */}
        {items.map((item) => {
          const favourable = !!item.food;
          return (
            <View key={item.key} style={styles.foodRow}>
              {favourable ? (
                <TouchableOpacity onPress={() => toggleFavourite(item.food)}>
                  <Ionicons
                    name={isFavourite(item.food.id) ? 'star' : 'star-outline'}
                    size={16}
                    color="#48DDB0"
                  />
                </TouchableOpacity>
              ) : (
                <Ionicons name="time-outline" size={16} color="#60766E" />
              )}

              <View style={styles.foodInfo}>
                <Text style={styles.foodName}>{item.name}</Text>
                <Text style={styles.foodMeta}>
                  {Math.round(item.calories)} kcal
                  {item.brand ? ` · ${item.brand}` : ''}
                  {` for ${item.quantity} ${item.unit}`}
                </Text>
              </View>

              {addingId === item.key ? (
                <ActivityIndicator size="small" color="#48DDB0" />
              ) : (
                <TouchableOpacity onPress={() => handleAdd(item)}>
                  <Ionicons name="add-circle-outline" size={22} color="#48DDB0" />
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {items.length === 0 && !isSearching && !searchError && (
          <Text style={styles.empty}>
            {searching
              ? 'No matches found.'
              : tab === 'My Favourites'
                ? 'Star a food while searching to save it here.'
                : 'Nothing logged yet — search above to add something.'}
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

  error: {
    color: '#E07A5F',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 12,
  },

  empty: {
    color: '#60766E',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 20,
    paddingHorizontal: 40,
  },
});