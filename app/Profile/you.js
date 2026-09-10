import { useProfile } from '@/contexts/profile-context';
import { CONDITIONS, GENDERS } from '@/src/profile-options';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileYou() {
  const { profile, updateProfile } = useProfile();

  const [dateOfBirth, setDateOfBirth] = useState(profile.date_of_birth ?? '');
  const [gender, setGender] = useState(profile.gender);
  const [country, setCountry] = useState('');
  const [heightCm, setHeightCm] = useState(profile.height_cm?.toString() ?? '');
  const [weightKg, setWeightKg] = useState(profile.weight_kg?.toString() ?? '');
  const [conditions, setConditions] = useState(profile.health_conditions ?? []);
  const [otherCondition, setOtherCondition] = useState(profile.other_condition ?? '');
  const [saving, setSaving] = useState(false);

  const toggleCondition = (id) => {
    setConditions((prev) => {
      if (id === 'none') return prev.includes('none') ? [] : ['none'];
      return prev.includes(id)
        ? prev.filter((c) => c !== id)
        : [...prev.filter((c) => c !== 'none'), id];
    });
  };

  const handleContinue = async () => {
    setSaving(true);
    await updateProfile({
      date_of_birth: dateOfBirth || null,
      gender,
      height_cm: heightCm ? Number(heightCm) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      health_conditions: conditions,
      other_condition: conditions.includes('other') ? otherCondition : null,
    });
    setSaving(false);
    router.push('/Profile/goal');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <Text style={styles.tagline}>Know your nutrients, Know your health</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.step}>
            <Text style={styles.activeStep}>Step 1: You</Text>
            <View style={styles.activeLine} />
          </View>

          <View style={styles.step}>
            <Text style={styles.inactiveStep}>Step 2: Your Goals</Text>
            <View style={styles.inactiveLine} />
          </View>

          <View style={styles.step}>
            <Text style={styles.inactiveStep}>Step 3: Your Lifestyle</Text>
            <View style={styles.inactiveLine} />
          </View>
        </View>

        <Text style={styles.title}>Tell us about you</Text>
        <Text style={styles.description}>
          This information helps Knowtrients give recommendations more accurately
        </Text>

        {/* Date of birth */}
        <Text style={styles.label}>Date of Birth:</Text>
        <View style={styles.dateInput}>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#60766E"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
          />
          <Text style={styles.icon}>□</Text>
        </View>

        {/* Gender */}
        <View style={styles.genderRow}>
          <Text style={styles.label}>Gender:</Text>

          {GENDERS.map((option) => {
            const selected = gender === option.id;
            return (
              <Pressable
                key={option.id}
                style={styles.radioRow}
                onPress={() => setGender(option.id)}
              >
                <View style={[styles.circle, selected && styles.circleSelected]}>
                  {selected && <View style={styles.dot} />}
                </View>
                <Text style={styles.genderText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Country — not stored by the backend yet */}
        <Text style={styles.label}>Country:</Text>
        <View style={styles.countryInput}>
          <TextInput
            style={styles.countryText}
            placeholder="Select Country"
            placeholderTextColor="#60766E"
            value={country}
            onChangeText={setCountry}
          />
          <Text style={styles.arrow}>⌄</Text>
        </View>

        <Text style={styles.helperText}>
          Knowing your country allows Knowtrients to recommend local dishes to you.
        </Text>

        {/* Height + weight */}
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Height (cm):</Text>
            <View style={styles.measureInput}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 170"
                placeholderTextColor="#60766E"
                keyboardType="numeric"
                value={heightCm}
                onChangeText={setHeightCm}
              />
              <Text style={styles.unit}>cm</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Weight (kg):</Text>
            <View style={styles.measureInput}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 68"
                placeholderTextColor="#60766E"
                keyboardType="numeric"
                value={weightKg}
                onChangeText={setWeightKg}
              />
              <Text style={styles.unit}>kg</Text>
            </View>
          </View>
        </View>

        {/* Medical conditions */}
        <Text style={styles.label}>Medical Conditions</Text>

        <View style={styles.conditionContainer}>
          {CONDITIONS.map((item) => {
            const selected = conditions.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => toggleCondition(item.id)}
                style={selected ? styles.selectedCondition : styles.conditionButton}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text style={selected ? styles.selectedText : styles.conditionText}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {conditions.includes('other') && (
          <TextInput
            style={styles.conditionInput}
            placeholder="Describe your condition(s)..."
            placeholderTextColor="#60766E"
            value={otherCondition}
            onChangeText={setOtherCondition}
          />
        )}

        <Text style={styles.conditionHelper}>
          Select all that apply. This helps Knowtrients personalise your
          recommendations safely.
        </Text>

        {/* Continue */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          disabled={saving}
        >
          <Text style={styles.continueText}>
            {saving ? 'Saving...' : 'Continue →'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020D09' },

  logoContainer: { paddingLeft: 25, paddingTop: 30, marginBottom: 30 },

  logo: { color: '#fff', fontSize: 20, fontFamily: 'serif' },
  tagline: { color: '#fff', fontSize: 12, marginTop: 3 },

  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 25,
    marginBottom: 30,
  },

  step: { flex: 1 },

  activeStep: { color: '#48DDB0', fontSize: 10, marginBottom: 5 },
  inactiveStep: { color: '#17644E', fontSize: 10, marginBottom: 5 },

  activeLine: { height: 3, backgroundColor: '#48DDB0', borderRadius: 5 },
  inactiveLine: { height: 3, backgroundColor: '#123B2F', borderRadius: 5 },

  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: 'serif',
    fontWeight: 'bold',
    paddingHorizontal: 25,
    marginBottom: 5,
  },

  description: {
    color: '#3AA889',
    fontSize: 13,
    lineHeight: 17,
    paddingHorizontal: 25,
    marginBottom: 20,
  },

  label: {
    color: '#D4E6DF',
    fontSize: 12,
    marginBottom: 7,
    marginTop: 12,
    paddingHorizontal: 25,
  },

  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10251E',
    width: 135,
    height: 38,
    borderRadius: 7,
    paddingHorizontal: 10,
    marginHorizontal: 25,
  },

  input: { flex: 1, color: '#FFFFFF', fontSize: 12, padding: 0 },

  icon: { color: '#A5DCCC', fontSize: 18 },

  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingRight: 25,
  },

  radioRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 15 },

  circle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  circleSelected: { borderColor: '#48DDB0' },

  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#48DDB0' },

  genderText: { color: '#D4E6DF', fontSize: 12, marginLeft: 5 },

  countryInput: {
    width: 165,
    height: 38,
    backgroundColor: '#10251E',
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginHorizontal: 25,
  },

  countryText: { flex: 1, color: '#fff', fontSize: 12, padding: 0 },

  arrow: { color: '#48DDB0', fontSize: 18 },

  helperText: {
    color: '#60766E',
    fontSize: 9,
    marginTop: 7,
    paddingHorizontal: 25,
  },

  row: { flexDirection: 'row', gap: 20, paddingHorizontal: 25 },

  field: { flex: 1 },

  measureInput: {
    height: 38,
    backgroundColor: '#10251E',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  unit: { color: '#48DDB0', fontSize: 11, fontWeight: 'bold' },

  conditionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 25,
  },

  conditionButton: {
    backgroundColor: '#102A21',
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 20,
  },

  selectedCondition: {
    backgroundColor: '#102A21',
    borderWidth: 1,
    borderColor: '#48DDB0',
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 20,
  },

  conditionText: { color: '#60766E', fontSize: 11 },
  selectedText: { color: '#48DDB0', fontSize: 11 },

  conditionInput: {
    height: 42,
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    marginHorizontal: 25,
  },

  conditionHelper: {
    color: '#60766E',
    fontSize: 9,
    marginTop: 7,
    paddingHorizontal: 25,
  },

  continueButton: {
    backgroundColor: '#48DDB0',
    width: 143,
    height: 42,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 45,
  },

  continueText: { color: '#00382B', fontSize: 14, fontWeight: '600' },
});