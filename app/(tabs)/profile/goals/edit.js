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

const TIMELINES = ['1 Month', '3 Months', '6 Months', '1 Year'];

export default function EditGoals() {
  const { profile, updateProfile } = useProfile();

  const [goals, setGoals] = useState(profile.goals);
  const [otherGoal, setOtherGoal] = useState(profile.otherGoal);
  const [timeline, setTimeline] = useState(profile.timeline);
  const [showTimelines, setShowTimelines] = useState(false);

  const toggleGoal = (id) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    updateProfile({
      goals,
      otherGoal: goals.includes('other') ? otherGoal : '',
      timeline,
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

        <Text style={styles.label}>Timeline</Text>
        <Text style={styles.helper}>
          How fast would you like to achieve these goals?
        </Text>

        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowTimelines(!showTimelines)}
        >
          <Text style={timeline ? styles.dropdownValue : styles.dropdownPlaceholder}>
            {timeline ?? 'Select a Timeline'}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#48DDB0" />
        </TouchableOpacity>

        {showTimelines && (
          <View style={styles.dropdownMenu}>
            {TIMELINES.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => {
                  setTimeline(t);
                  setShowTimelines(false);
                }}
              >
                <Text style={styles.dropdownOption}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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

  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    width: 170,
    marginHorizontal: 25,
  },

  dropdownPlaceholder: { color: '#60766E', fontSize: 12 },
  dropdownValue: { color: '#fff', fontSize: 12 },

  dropdownMenu: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    padding: 8,
    width: 170,
    marginHorizontal: 25,
    marginTop: 4,
  },

  dropdownOption: { color: '#D4E6DF', fontSize: 12, paddingVertical: 7 },

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