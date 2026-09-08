import { useProfile } from '@/contexts/profile-context';
import { ACTIVITY_LEVELS, DIETARY } from '@/src/profile-options';
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

export default function EditLifestyle() {
  const { profile, updateProfile } = useProfile();

  const [activityLevel, setActivityLevel] = useState(profile.activityLevel);
  const [dietary, setDietary] = useState(profile.dietaryPreferences);
  const [otherDietary, setOtherDietary] = useState(profile.otherDietary);

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

  const handleSave = () => {
    updateProfile({
      activityLevel,
      dietaryPreferences: dietary,
      otherDietary: dietary.includes('other') ? otherDietary : '',
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

        <Text style={styles.title}>Edit My Lifestyle</Text>
        <Text style={styles.subtitle}>
          Let Knowtrients give you recommendations that suits your lifestyle
        </Text>

        {/* Activity level — single select */}
        <Text style={styles.label}>Activity Level</Text>
        <Text style={styles.helper}>How active are you? Select one.</Text>

        <View style={styles.levelList}>
          {ACTIVITY_LEVELS.map((level) => {
            const selected = activityLevel === level.id;
            return (
              <TouchableOpacity
                key={level.id}
                onPress={() => setActivityLevel(level.id)}
                style={selected ? styles.levelSelected : styles.levelBox}
              >
                <Text style={styles.levelTitle}>{level.label}</Text>
                {level.description !== '' && (
                  <Text style={styles.levelDescription}>{level.description}</Text>
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
          {DIETARY.map((d) => {
            const selected = dietary.includes(d.id);
            return (
              <TouchableOpacity
                key={d.id}
                onPress={() => toggleDietary(d.id)}
                style={selected ? styles.chipSelected : styles.chip}
              >
                <Text style={selected ? styles.chipTextSelected : styles.chipText}>
                  {d.label}
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
            value={otherDietary}
            onChangeText={setOtherDietary}
          />
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

  levelList: { gap: 8, paddingHorizontal: 25 },

  levelBox: {
    backgroundColor: '#07140F',
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },

  levelSelected: {
    backgroundColor: '#07140F',
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },

  levelTitle: { color: '#48DDB0', fontSize: 12, fontWeight: '500' },
  levelDescription: { color: '#60766E', fontSize: 10, marginTop: 2 },

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
    paddingHorizontal: 12,
    height: 42,
    color: '#4ECBA0',
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