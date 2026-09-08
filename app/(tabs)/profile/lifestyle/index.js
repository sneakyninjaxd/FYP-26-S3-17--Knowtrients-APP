import { useProfile } from '@/contexts/profile-context';
import { ACTIVITY_LEVELS, DIETARY, labelFor } from '@/src/profile-options';
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

export default function MyLifestyle() {
  const { profile } = useProfile();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>My Lifestyle</Text>
        <Text style={styles.subtitle}>
          Let Knowtrients give you recommendations that suits your lifestyle
        </Text>

        <Text style={styles.sectionLabel}>Activity Level</Text>

        <View style={styles.levelBox}>
          <Text style={styles.levelText}>
            {profile.activityLevel
              ? labelFor(ACTIVITY_LEVELS, profile.activityLevel)
              : 'Not set'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Dietary Preference</Text>

        <View style={styles.chipWrap}>
          {profile.dietaryPreferences.length === 0 && (
            <Text style={styles.empty}>None selected</Text>
          )}

          {profile.dietaryPreferences.map((id) => (
            <View key={id} style={styles.chip}>
              <Text style={styles.chipText}>{labelFor(DIETARY, id)}</Text>
            </View>
          ))}
        </View>

        {profile.dietaryPreferences.includes('other') && (
          <View style={styles.otherBox}>
            <Text style={styles.otherText}>
              {profile.otherDietary || 'No description added'}
            </Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/profile/lifestyle/edit')}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020D09' },
  scroll: { paddingBottom: 30, flexGrow: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingVertical: 20,
  },

  logo: { color: '#fff', fontSize: 20, fontFamily: 'serif' },

  title: { color: '#fff', fontSize: 32, fontFamily: 'serif', paddingHorizontal: 25 },

  subtitle: {
    color: '#3AA889',
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 25,
    marginTop: 6,
    marginBottom: 20,
  },

  sectionLabel: {
    color: '#D4E6DF',
    fontSize: 12,
    paddingHorizontal: 25,
    marginTop: 14,
    marginBottom: 10,
  },

  levelBox: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 25,
  },

  levelText: { color: '#48DDB0', fontSize: 12 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 25 },

  chip: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },

  chipText: { color: '#48DDB0', fontSize: 11 },
  empty: { color: '#60766E', fontSize: 11 },

  otherBox: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 25,
    marginTop: 12,
  },

  otherText: { color: '#4ECBA0', fontSize: 11 },

  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 25,
    marginTop: 'auto',
    paddingTop: 30,
  },

  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  backText: { color: '#fff', fontSize: 13 },

  editButton: {
    flex: 1,
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  editText: { color: '#00382B', fontSize: 13, fontWeight: '600' },
});