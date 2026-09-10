import { useProfile } from '@/contexts/profile-context';
import { GOALS } from '@/src/profile-options';
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

export default function EditGoals() {
  const { profile, updateProfile } = useProfile();

  const [goals, setGoals] = useState(profile.goals ?? []);
  const [otherGoal, setOtherGoal] = useState(profile.other_goal ?? '');
  const [targetWeight, setTargetWeight] = useState(
    profile.target_weight_kg?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);

  const toggleGoal = (id) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await updateProfile({
      goals,
      other_goal: goals.includes('other') ? otherGoal : null,
      target_weight_kg: targetWeight ? Number(targetWeight) : null,
    });
    setSaving(false);
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

        <Text style={styles.title}>Edit My Goals</Text>
        <Text style={styles.subtitle}>
          Let us know what you would like to achieve so that we can guide you better
        </Text>

        <Text style={styles.label}>What is your Primary Goal?</Text>
        <Text style={styles.helper}>
          Select all that apply. This allows Knowtrients give recommendations
          according to your goals.
        </Text>

        <View style={styles.chipWrap}>
          {GOALS.map((g) => {
            const selected = goals.includes(g.id);
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => toggleGoal(g.id)}
                style={selected ? styles.chipSelected : styles.chip}
              >
                <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {goals.includes('other') && (
          <TextInput
            style={styles.otherInput}
            placeholder="Describe your goal(s)..."
            placeholderTextColor="#60766E"
            multiline
            value={otherGoal}
            onChangeText={setOtherGoal}
          />
        )}

        <Text style={styles.label}>Target Weight (kg)</Text>

        <View style={styles.measureBox}>
          <TextInput
            style={styles.measureInput}
            placeholder="e.g. 68"
            placeholderTextColor="#60766E"
            keyboardType="numeric"
            value={targetWeight}
            onChangeText={setTargetWeight}
          />
          <Text style={styles.unit}>kg</Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
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

  title: { color: '#fff', fontSize: 30, fontFamily: 'serif', paddingHorizontal: 25 },

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
    fontSize: 12,
    paddingHorizontal: 25,
    marginTop: 16,
    marginBottom: 4,
  },

  helper: {
    color: '#3AA889',
    fontSize: 10,
    lineHeight: 14,
    paddingHorizontal: 25,
    marginBottom: 10,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 25 },

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
    padding: 12,
    height: 60,
    textAlignVertical: 'top',
    color: '#4ECBA0',
    marginHorizontal: 25,
    marginTop: 12,
  },

  measureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    width: 150,
    marginHorizontal: 25,
  },

  measureInput: { flex: 1, color: '#fff', fontSize: 12, padding: 0 },
  unit: { color: '#48DDB0', fontSize: 11, fontWeight: 'bold' },

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