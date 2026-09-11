import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const LOG_OPTIONS = [
  { id: 'activities', label: 'My Activities', path: '/log/activities' },
  { id: 'sleep', label: 'My Sleep', path: '/log/sleep/sleep' },
  { id: 'food', label: 'My Food intake', path: '/log/foodintake' },
];

export default function LogScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 + insets.bottom }}>
        {/* Logo */}
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

        <View>
          <Text style={styles.title}>Log</Text>
          <Text style={styles.description}>What would you like to log?</Text>

          {LOG_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.activityBox}
              onPress={() => router.push(option.path)}
            >
              <Text style={styles.activity}>{option.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#3AA889" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020D09',
  },

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
    color: '#FFFFFF',
    fontSize: 35,
    fontFamily: 'serif',
    marginBottom: 5,
    paddingLeft: 25,
    paddingTop: 10,
  },

  description: {
    color: '#3AA889',
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 20,
    paddingLeft: 25,
  },

  activityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  activity: {
    color: '#3AA889',
    fontSize: 13,
  },
});