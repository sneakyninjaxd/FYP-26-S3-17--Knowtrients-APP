import { useProfile } from '@/contexts/profile-context';
import { CONDITIONS, GENDERS } from '@/src/profile-options';
import { Ionicons } from '@expo/vector-icons';
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

export default function EditInformation() {
  const { profile, updateProfile } = useProfile();

  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '');
  const [gender, setGender] = useState(profile.gender);
  const [country, setCountry] = useState(profile.country ?? '');
  const [height, setHeight] = useState(profile.heightCm?.toString() ?? '');
  const [weight, setWeight] = useState(profile.weightKg?.toString() ?? '');
  const [conditions, setConditions] = useState(profile.conditions);
  const [otherCondition, setOtherCondition] = useState(profile.otherCondition);

  const toggleCondition = (id) => {
    setConditions((prev) => {
      if (id === 'none') return prev.includes('none') ? [] : ['none'];
      return prev.includes(id)
        ? prev.filter((c) => c !== id)
        : [...prev.filter((c) => c !== 'none'), id];
    });
  };

  const handleSave = () => {
    updateProfile({
      dateOfBirth: dateOfBirth || null,
      gender,
      country: country || null,
      heightCm: height ? Number(height) : null,
      weightKg: weight ? Number(weight) : null,
      conditions,
      otherCondition: conditions.includes('other') ? otherCondition : '',
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Edit My Information</Text>
        <Text style={styles.subtitle}>
          Your measurements helps Knowtrients give recommendations more accurately
        </Text>

        {/* Date of birth */}
        <Text style={styles.label}>Date of Birth:</Text>
        <View style={styles.dateBox}>
          <TextInput
            style={styles.dateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#60766E"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
          />
          <Ionicons name="calendar-outline" size={18} color="#48DDB0" />
        </View>

        {/* Gender */}
        <View style={styles.genderRow}>
          <Text style={styles.inlineLabel}>Gender:</Text>

          {GENDERS.map((g) => {
            const selected = gender === g.id;
            return (
              <Pressable
                key={g.id}
                style={styles.radioRow}
                onPress={() => setGender(g.id)}
              >
                <View style={[styles.circle, selected && styles.circleSelected]}>
                  {selected && <View style={styles.dot} />}
                </View>
                <Text style={styles.radioText}>{g.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Country */}
        <View style={styles.countryRow}>
          <Text style={styles.inlineLabel}>Country:</Text>
          <TextInput
            style={styles.countryInput}
            placeholder="Select Country"
            placeholderTextColor="#60766E"
            value={country}
            onChangeText={setCountry}
          />
        </View>

        <Text style={styles.helper}>
          Knowing your country allows Knowtrients to recommend local dishes to you.
        </Text>

        {/* Height + weight */}
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Height (cm):</Text>
            <View style={styles.measureBox}>
              <TextInput
                style={styles.measureInput}
                placeholder="170"
                placeholderTextColor="#60766E"
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
              />
              <Text style={styles.unit}>cm</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Weight (kg):</Text>
            <View style={styles.measureBox}>
              <TextInput
                style={styles.measureInput}
                placeholder="76"
                placeholderTextColor="#60766E"
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
              />
              <Text style={styles.unit}>kg</Text>
            </View>
          </View>
        </View>

        {/* Conditions */}
        <Text style={styles.label}>Medical Conditions</Text>

        <View style={styles.chipWrap}>
          {CONDITIONS.map((c) => {
            const selected = conditions.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => toggleCondition(c.id)}
                style={selected ? styles.chipSelected : styles.chip}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {conditions.includes('other') && (
          <TextInput
            style={styles.otherInput}
            placeholder="Describe your condition(s)..."
            placeholderTextColor="#60766E"
            value={otherCondition}
            onChangeText={setOtherCondition}
          />
        )}

        <Text style={styles.helper}>
          Select all that apply. This helps Knowtrients personalise your
          recommendations safely
        </Text>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>Save</Text>
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
    fontSize: 30,
    fontFamily: 'serif',
    paddingHorizontal: 25,
  },

  subtitle: {
    color: '#3AA889',
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 25,
    marginTop: 6,
    marginBottom: 16,
  },

  label: {
    color: '#D4E6DF',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 14,
    marginBottom: 6,
  },

  inlineLabel: { color: '#D4E6DF', fontSize: 11 },

  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    width: 150,
    marginHorizontal: 25,
  },

  dateInput: { flex: 1, color: '#fff', fontSize: 12, padding: 0 },

  genderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 25,
    marginTop: 16,
  },

  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  circle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },

  circleSelected: { borderColor: '#48DDB0' },

  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#48DDB0' },

  radioText: { color: '#D4E6DF', fontSize: 11 },

  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 25,
    marginTop: 16,
  },

  countryInput: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    width: 160,
    color: '#fff',
    fontSize: 12,
  },

  helper: {
    color: '#60766E',
    fontSize: 9,
    lineHeight: 13,
    paddingHorizontal: 25,
    marginTop: 8,
  },

  row: { flexDirection: 'row', gap: 16, paddingHorizontal: 25 },
  field: { flex: 1 },

  measureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },

  measureInput: { flex: 1, color: '#fff', fontSize: 12, padding: 0 },
  unit: { color: '#48DDB0', fontSize: 11, fontWeight: 'bold' },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 25,
  },

  chip: {
    backgroundColor: '#102A21',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },

  chipSelected: {
    backgroundColor: '#102A21',
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },

  chipText: { color: '#60766E', fontSize: 11 },
  chipTextSelected: { color: '#48DDB0', fontSize: 11 },

  otherInput: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    color: '#fff',
    marginHorizontal: 25,
    marginTop: 12,
  },

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

  saveButton: {
    flex: 1,
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  saveText: { color: '#00382B', fontSize: 13, fontWeight: '600' },
});