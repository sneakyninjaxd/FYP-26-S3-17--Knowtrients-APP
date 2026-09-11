import { useProfile } from '@/contexts/profile-context';
import { NUTRIENTS, positionFor } from '@/src/nutrients';
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

const ZONES = [
  { key: 'low', label: 'Low Intake', color: '#3A9BD9' },
  { key: 'recommended', label: 'Recommended Intake', color: '#4ECBA0' },
  { key: 'high', label: 'High Intake', color: '#D9433F' },
];

export default function NutritionSummary() {
  const { profile } = useProfile();
  const isPremium = profile.plan === 'premium';

  const available = RANGES.filter((r) => !r.premium || isPremium);

  const [range, setRange] = useState(available[0]);
  const [showRanges, setShowRanges] = useState(false);

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

        <Text style={styles.title}>Nutrition Summary</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>

        {/* Legend card */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Checking your intake</Text>
          <Text style={styles.legendHelper}>
            Your nutrient intake is shown on a bar with 3 colours that represents
            different intake ranges
          </Text>

          {ZONES.map((zone) => (
            <View key={zone.key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: zone.color }]} />
              <Text style={[styles.legendLabel, { color: zone.color }]}>
                {zone.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Range picker */}
        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>Average Intake</Text>

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

        {/* Nutrient cards */}
        {NUTRIENTS.map((nutrient) => {
          const position = positionFor(nutrient);

          return (
            <View key={nutrient.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.nutrientName}>{nutrient.label}</Text>
                <Text style={styles.nutrientValue}>
                  {nutrient.average}{nutrient.unit}
                </Text>
              </View>

              {/* Zoned bar */}
              <View style={styles.barWrap}>
                <View style={styles.bar}>
                  <View style={[styles.zone, {
                    flex: nutrient.lowMax,
                    backgroundColor: '#3A9BD9',
                  }]} />
                  <View style={[styles.zone, {
                    flex: nutrient.recommendedMax - nutrient.lowMax,
                    backgroundColor: '#4ECBA0',
                  }]} />
                  <View style={[styles.zone, {
                    flex: 100 - nutrient.recommendedMax,
                    backgroundColor: '#D9433F',
                  }]} />
                </View>

                <View style={[styles.marker, { left: `${position}%` }]} />
              </View>

              {/* Sources */}
              {nutrient.sources.map((source, i) => (
                <View key={i} style={styles.sourceRow}>
                  <Text style={styles.sourceName}>{source.name}</Text>
                  <View style={styles.sourceLine} />
                  <Text style={styles.sourceAmount}>{source.amount}</Text>
                </View>
              ))}
            </View>
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
    fontSize: 28,
    fontFamily: 'serif',
    paddingHorizontal: 25,
  },

  date: {
    color: '#3AA889',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 16,
  },

  legendCard: {
    backgroundColor: '#07140F',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 25,
    marginBottom: 16,
  },

  legendTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },

  legendHelper: {
    color: '#60766E',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 6,
    marginBottom: 10,
  },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 9 },

  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    marginBottom: 12,
  },

  rangeLabel: { color: '#D4E6DF', fontSize: 12 },

  rangePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#48DDB0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  rangeText: { color: '#00382B', fontSize: 9, fontWeight: '600' },

  rangeMenu: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  rangeOption: { color: '#D4E6DF', fontSize: 11, paddingVertical: 6 },

  card: {
    backgroundColor: '#07140F',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  nutrientName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  nutrientValue: { color: '#D4E6DF', fontSize: 12 },

  barWrap: { position: 'relative', marginBottom: 14 },

  bar: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden' },

  zone: { height: 5 },

  marker: {
    position: 'absolute',
    top: -3,
    width: 2,
    height: 11,
    backgroundColor: '#fff',
    borderRadius: 1,
  },

  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },

  sourceName: { color: '#60766E', fontSize: 8 },
  sourceLine: { flex: 1, height: 1, backgroundColor: '#123B2F' },
  sourceAmount: { color: '#60766E', fontSize: 8 },
});