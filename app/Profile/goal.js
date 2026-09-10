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

export default function ProfileGoal() {
  const { profile, updateProfile } = useProfile();

  const [goals, setGoals] = useState(profile.goals ?? []);
  const [otherGoal, setOtherGoal] = useState(profile.other_goal ?? '');
  const [timeline, setTimeline] = useState(null);
  const [showTimelines, setShowTimelines] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleGoal = (id) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleContinue = async () => {
    setSaving(true);
    await updateProfile({
      goals,
      other_goal: goals.includes('other') ? otherGoal : null,
    });
    setSaving(false);

    if (goals.includes('gain_weight')) {
      router.push('/Profile/gain-weight');
    } else if (goals.includes('lose_weight')) {
      router.push('/Profile/lose-weight');
    } else {
      router.push('/Profile/lifestyle');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.logoContainer}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <Text style={styles.tagline}>Know your nutrients, Know your health</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.step}>
            <Text style={styles.inactiveStep}>Step 1: You</Text>
            <View style={styles.inactiveLine} />
          </View>

          <View style={styles.step}>
            <Text style={styles.activeStep}>Step 2: Your Goals</Text>
            <View style={styles.activeLine} />
          </View>

          <View style={styles.step}>
            <Text style={styles.inactiveStep}>Step 3: Your Lifestyle</Text>
            <View style={styles.inactiveLine} />
          </View>
        </View>

        <Text style={styles.title}>Tell us about your{'\n'}Health Goals</Text>
        <Text style={styles.description}>
          Let us know what you would like to achieve so that we can guide you better
        </Text>

        {/* Goals */}
        <Text style={styles.label}>What is your Primary Goal?</Text>
        <Text style={styles.helper}>
          Select all that apply. This allows Knowtrients give recommendations
          according to your goals.
        </Text>

        <View style={styles.chipWrap}>
          {GOALS.map((goal) => {
            const selected = goals.includes(goal.id);
            return (
              <TouchableOpacity
                key={goal.id}
                onPress={() => toggleGoal(goal.id)}
                style={selected ? styles.chipSelected : styles.chip}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                  {goal.label}
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

        {/* Timeline — not stored by the backend yet */}
        <Text style={styles.label}>
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

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/Profile/you')}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            disabled={saving}
          >
            <Text style={styles.continueText}>
              {saving ? 'Saving...' : 'Continue →'}
            </Text>
          </TouchableOpacity>
        </View>

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
    backgroundColor: '#10251E',
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
    gap: 20,
    justifyContent: 'center',
    marginTop: 45,
  },

  backButton: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    width: 143,
    height: 42,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },

  backText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  continueButton: {
    backgroundColor: '#48DDB0',
    width: 143,
    height: 42,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },

  continueText: { color: '#00382B', fontSize: 14, fontWeight: '600' },
});