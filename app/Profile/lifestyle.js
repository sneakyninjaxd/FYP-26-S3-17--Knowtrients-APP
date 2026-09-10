import { useProfile } from '@/contexts/profile-context';
import { ACTIVITY_LEVELS, DIETARY } from '@/src/profile-options';
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

export default function Lifestyle() {
  const { profile, updateProfile } = useProfile();

  const [activityLevel, setActivityLevel] = useState(profile.activity_level);
  const [dietary, setDietary] = useState(profile.dietary_preferences ?? []);
  const [otherPreference, setOtherPreference] = useState(
    profile.other_preference ?? ''
  );
  const [saving, setSaving] = useState(false);

  const toggleDietary = (id) => {
    setDietary((prev) => {
      if (id === 'no_preference') {
        return prev.includes('no_preference') ? [] : ['no_preference'];
      }
      return prev.includes(id)
        ? prev.filter((d) => d !== id)
        : [...prev.filter((d) => d !== 'no_preference'), id];
    });
  };

  const handleContinue = async () => {
    setSaving(true);
    await updateProfile({
      activity_level: activityLevel,
      dietary_preferences: dietary,
      other_preference: dietary.includes('other') ? otherPreference : null,
    });
    setSaving(false);
    router.push('/Profile/finish');
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
            <Text style={styles.inactiveStep}>Step 2: Your Goals</Text>
            <View style={styles.inactiveLine} />
          </View>

          <View style={styles.step}>
            <Text style={styles.activeStep}>Step 3: Your Lifestyle</Text>
            <View style={styles.activeLine} />
          </View>
        </View>

        <Text style={styles.title}>Let us know about your Lifestyle</Text>
        <Text style={styles.description}>
          Let Knowtrients understand you better to give you recommendations that
          fits your lifestyle
        </Text>

        {/* Activity level — single select */}
        <Text style={styles.label}>Activity Level</Text>
        <Text style={styles.helper}>How active are you? Select one.</Text>

        <View style={styles.activityContainer}>
          {ACTIVITY_LEVELS.map((level) => {
            const selected = activityLevel === level.id;
            return (
              <TouchableOpacity
                key={level.id}
                onPress={() => setActivityLevel(level.id)}
                style={selected ? styles.selectedActivity : styles.activityButton}
              >
                <Text style={styles.activityTitle}>{level.label}</Text>
                {level.description !== '' && (
                  <Text style={styles.activityDescription}>{level.description}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dietary — multi select */}
        <Text style={styles.label}>Dietary Preference</Text>
        <Text style={styles.helper}>
          Select all that apply. This allows Knowtrients to give recommendations
          according to your diet
        </Text>

        <View style={styles.chipWrap}>
          {DIETARY.map((item) => {
            const selected = dietary.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => toggleDietary(item.id)}
                style={selected ? styles.chipSelected : styles.chip}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {dietary.includes('other') && (
          <TextInput
            style={styles.otherInput}
            placeholder="Describe your preference(s)..."
            placeholderTextColor="#60766E"
            value={otherPreference}
            onChangeText={setOtherPreference}
          />
        )}

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/Profile/goal')}
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

  activityContainer: { gap: 8, paddingHorizontal: 25 },

  activityButton: {
    backgroundColor: '#07140F',
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    minHeight: 35,
    paddingVertical: 6,
    paddingHorizontal: 15,
  },

  selectedActivity: {
    backgroundColor: '#07140F',
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 12,
    minHeight: 35,
    paddingVertical: 6,
    paddingHorizontal: 15,
  },

  activityTitle: { color: '#48DDB0', fontSize: 12, fontWeight: '500' },
  activityDescription: { color: '#60766E', fontSize: 10, marginTop: 2 },

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
    color: '#4ECBA0',
    marginHorizontal: 25,
    marginTop: 12,
  },

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