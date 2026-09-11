import { useActivities } from '@/contexts/activity-context';
import { toLogDate } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

const INTENSITIES = ['Easy', 'Moderate', 'Intense'];

const EXERCISE_TYPES = [
  'Cardio',
  'Strength Training',
  'Flexibility',
  'Sports',
  'Walking',
  'Swimming',
  'Cycling',
  'Other',
];

export default function AddActivities() {
  const { addActivity } = useActivities();

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('Easy');
  const [notes, setNotes] = useState('');
  const [showTypes, setShowTypes] = useState(false);
  const [saving, setSaving] = useState(false);

  const minutes = Number(duration);
  const canSubmit = type && minutes > 0 && minutes <= 1440;

  /**
   * The API has activity_type but no separate name field, so the typed
   * name is kept in notes rather than dropped.
   */
  const handleAdd = async () => {
    if (!canSubmit || saving) return;

    setSaving(true);
    try {
      const noteParts = [name.trim(), notes.trim()].filter(Boolean);

      const created = await addActivity({
        activity_type: type,
        duration_minutes: minutes,
        intensity,
        notes: noteParts.join(' — ') || null,
        date: toLogDate(),
      });

      if (!created) {
        alert('Could not save this activity. Please try again.');
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

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

        <Text style={styles.title}>Add Activities</Text>
        <Text style={styles.subtitle}>Insert your daily activities here</Text>

        {/* Exercise name */}
        <Text style={styles.label}>
          Exercise Name <Text style={styles.optional}>(Optional)</Text>
        </Text>
        <TextInput
          style={styles.textField}
          placeholder="Name this exercise"
          placeholderTextColor="#60766E"
          value={name}
          onChangeText={setName}
        />

        {/* Type / Duration + Intensity */}
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Select Exercise Type</Text>

            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowTypes(!showTypes)}
            >
              <Text style={type ? styles.dropdownValue : styles.dropdownPlaceholder}>
                {type || 'Select exercise'}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#48DDB0" />
            </TouchableOpacity>

            {showTypes && (
              <View style={styles.dropdownMenu}>
                {EXERCISE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      setType(t);
                      setShowTypes(false);
                    }}
                  >
                    <Text style={styles.dropdownOption}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Duration</Text>
            <View style={styles.measureInput}>
              <TextInput
                style={styles.measureText}
                placeholder="e.g. 50"
                placeholderTextColor="#60766E"
                keyboardType="numeric"
                value={duration}
                onChangeText={setDuration}
              />
              <Text style={styles.unit}>min</Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Intensity</Text>
            {INTENSITIES.map((level) => {
              const selected = intensity === level;
              return (
                <TouchableOpacity
                  key={level}
                  onPress={() => setIntensity(level)}
                  style={[styles.intensityBox, selected && styles.intensityBoxActive]}
                >
                  <Text style={selected ? styles.intensityTextActive : styles.intensityText}>
                    {level}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <Text style={styles.label}>
          Notes <Text style={styles.optional}>(Optional)</Text>
        </Text>
        <TextInput
          style={styles.notesField}
          placeholder="Describe your feelings or workout..."
          placeholderTextColor="#60766E"
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        {/* Add */}
        <TouchableOpacity
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
          onPress={handleAdd}
          disabled={!canSubmit || saving}
        >
          <Text style={styles.submitText}>{saving ? 'Saving…' : 'Add'}</Text>
        </TouchableOpacity>

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
    fontSize: 32,
    fontFamily: 'serif',
    paddingHorizontal: 25,
    paddingTop: 10,
  },

  subtitle: {
    color: '#3AA889',
    fontSize: 12,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 12,
  },

  label: {
    color: '#D4E6DF',
    fontSize: 12,
    marginBottom: 6,
    marginTop: 14,
    paddingHorizontal: 25,
  },

  optional: { color: '#60766E', fontSize: 10 },

  textField: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    marginHorizontal: 25,
  },

  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 25 },

  field: { flex: 1 },

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },

  dropdownPlaceholder: { color: '#60766E', fontSize: 12 },
  dropdownValue: { color: '#fff', fontSize: 12 },

  dropdownMenu: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },

  dropdownOption: { color: '#D4E6DF', fontSize: 12, paddingVertical: 7 },

  measureInput: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 40,
  },

  measureText: { flex: 1, color: '#fff', fontSize: 12, padding: 0 },

  unit: { color: '#48DDB0', fontSize: 11, fontWeight: 'bold' },

  intensityBox: {
    backgroundColor: '#0A1A14',
    borderRadius: 20,
    paddingVertical: 9,
    alignItems: 'center',
    marginBottom: 8,
  },

  intensityBoxActive: { borderWidth: 1, borderColor: '#48DDB0' },

  intensityText: { color: '#60766E', fontSize: 12 },
  intensityTextActive: { color: '#48DDB0', fontSize: 12 },

  notesField: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    height: 70,
    textAlignVertical: 'top',
    marginHorizontal: 25,
  },

  submit: {
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 60,
    marginTop: 60,
  },

  submitDisabled: { opacity: 0.5 },

  submitText: { color: '#00382B', fontSize: 15, fontWeight: '600' },
});