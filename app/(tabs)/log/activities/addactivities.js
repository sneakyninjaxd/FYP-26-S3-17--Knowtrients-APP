import { useActivities } from '@/contexts/activity-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const INTENSITIES = ['Easy', 'Moderate', 'Intense'];

export default function AddActivities() {
  const { addActivity } = useActivities();

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('Easy');
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    if (!name) return;

    addActivity({
      name,
      type: type || 'Exercise',
      duration: `${duration || 0}min`,
      intensity,
      notes,
      calories: 0,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-GB', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    });

    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Add Activities</Text>
        <Text style={styles.subtitle}>Insert your daily activities here</Text>

        {/* Exercise name */}
        <Text style={styles.label}>Exercise Name</Text>
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
            <TextInput
              style={styles.smallField}
              placeholder="Select exercise"
              placeholderTextColor="#60766E"
              value={type}
              onChangeText={setType}
            />

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
        <TouchableOpacity style={styles.submit} onPress={handleAdd}>
          <Text style={styles.submitText}>Add</Text>
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
    paddingVertical: 20,
  },

  logo: { color: '#fff', fontSize: 20, fontFamily: 'serif' },

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

  smallField: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 12,
  },

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

  submitText: { color: '#00382B', fontSize: 15, fontWeight: '600' },
});