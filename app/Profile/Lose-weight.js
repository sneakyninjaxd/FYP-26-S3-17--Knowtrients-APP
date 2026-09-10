import { useProfile } from '@/contexts/profile-context';
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

export default function LoseWeight() {
  const { profile, updateProfile } = useProfile();

  const [currentWeight, setCurrentWeight] = useState(
    profile.weight_kg?.toString() ?? ''
  );
  const [targetWeight, setTargetWeight] = useState(
    profile.target_weight_kg?.toString() ?? ''
  );
  const [saving, setSaving] = useState(false);

  const totalLoss =
    currentWeight && targetWeight
      ? Number(currentWeight) - Number(targetWeight)
      : null;

  const handleContinue = async () => {
    setSaving(true);
    await updateProfile({
      weight_kg: currentWeight ? Number(currentWeight) : null,
      target_weight_kg: targetWeight ? Number(targetWeight) : null,
    });
    setSaving(false);
    router.push('/Profile/lifestyle');
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

 <Text style={styles.label}>Since you chose to Lose Weight...</Text>
        <Text style={styles.description}>What is your target weight?</Text>

        <View style={styles.weightTimeline}>
          {/* Current */}
          <View style={styles.weightBox}>
            <Text style={styles.weightLabel}>Current Weight</Text>
            <View style={styles.measureInput}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 68"
                placeholderTextColor="#60766E"
                keyboardType="numeric"
                value={currentWeight}
                onChangeText={setCurrentWeight}
              />
              <Text style={styles.unit}>kg</Text>
            </View>
          </View>

          {/* Target */}
          <View style={styles.weightBox}>
            <Text style={styles.weightArrow}>↓</Text>
            <Text style={styles.weightLabel}>Target Weight</Text>
            <View style={styles.measureInput}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 75"
                placeholderTextColor="#60766E"
                keyboardType="numeric"
                value={targetWeight}
                onChangeText={setTargetWeight}
              />
              <Text style={styles.unit}>kg</Text>
            </View>
          </View>

          {/* Total */}
          <View style={styles.totalWeightBox}>
            <Text style={styles.totalWeightLabel}>Total Weight Loss</Text>
            <Text style={styles.totalWeightValue}>
              {totalGain !== null ? `${totalloss} kg` : '—'}
            </Text>
          </View>
        </View>

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
    marginTop: 12,
    marginBottom: 7,
  },

  weightTimeline: { alignItems: 'center', marginTop: 10 },

  weightBox: { alignItems: 'center', width: '100%' },

  weightLabel: { color: '#D4E6DF', fontSize: 12, marginBottom: 7 },

  weightArrow: { color: '#48DDB0', fontSize: 28, marginVertical: 8 },

  measureInput: {
    height: 38,
    width: 140,
    backgroundColor: '#10251E',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  input: { flex: 1, color: '#FFFFFF', fontSize: 12, padding: 0 },

  unit: { color: '#48DDB0', fontSize: 11, fontWeight: 'bold' },

  totalWeightBox: { alignItems: 'center', marginTop: 20 },

  totalWeightLabel: { color: '#D4E6DF', fontSize: 12, marginBottom: 5 },

  totalWeightValue: { color: '#48DDB0', fontSize: 22, fontWeight: 'bold' },

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