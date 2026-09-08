import { useProfile } from '@/contexts/profile-context';
import { CONDITIONS, GENDERS, labelFor } from '@/src/profile-options';
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

function Field({ label, value }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export default function MyInformation() {
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

        <Text style={styles.title}>My Information</Text>
        <Text style={styles.subtitle}>
          Ensure the measurements you&apos;ve entered is accurate to get better
          recommendations.
        </Text>

        <Field label="First Name:" value={profile.firstName} />
        <Field label="Last Name:" value={profile.lastName} />
        <Field label="Date of Birth:" value={profile.dateOfBirth} />
        <Field label="Gender:" value={labelFor(GENDERS, profile.gender)} />
        <Field label="Country:" value={profile.country} />
        <Field label="Height (cm):" value={profile.heightCm && `${profile.heightCm} cm`} />
        <Field label="Weight (kg):" value={profile.weightKg && `${profile.weightKg} kg`} />

        <Text style={styles.sectionLabel}>Medical Conditions</Text>

        <View style={styles.chipWrap}>
          {profile.conditions.length === 0 && (
            <Text style={styles.empty}>None selected</Text>
          )}

          {profile.conditions.map((id) => (
            <View key={id} style={styles.chip}>
              <Text style={styles.chipText}>{labelFor(CONDITIONS, id)}</Text>
            </View>
          ))}
        </View>

        {profile.conditions.includes('other') && (
          <View style={styles.otherBox}>
            <Text style={styles.otherText}>
              {profile.otherCondition || 'Describe your condition(s)...'}
            </Text>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/profile/information/edit')}
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

  title: {
    color: '#fff',
    fontSize: 32,
    fontFamily: 'serif',
    paddingHorizontal: 25,
  },

  subtitle: {
    color: '#3AA889',
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 25,
    marginTop: 6,
    marginBottom: 20,
  },

  fieldRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 25,
    marginBottom: 12,
  },

  fieldLabel: { color: '#fff', fontSize: 12, fontWeight: '600' },
  fieldValue: { color: '#4ECBA0', fontSize: 12 },

  sectionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 25,
    marginTop: 8,
    marginBottom: 10,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 25,
  },

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

  otherText: { color: '#60766E', fontSize: 11 },

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