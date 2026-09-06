import { useSleep } from '@/contexts/sleep-context';
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

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const PERIODS = ['am', 'pm'];

// "7:00 pm" → minutes since midnight
const toMinutes = ({ hour, minute, period }) => {
  let h = hour % 12;
  if (period === 'pm') h += 12;
  return h * 60 + Number(minute);
};

function TimeColumn({ values, selected, onSelect }) {
  return (
    <ScrollView style={styles.wheel} showsVerticalScrollIndicator={false}>
      {values.map((v) => (
        <TouchableOpacity key={v} onPress={() => onSelect(v)}>
          <Text style={String(v) === String(selected) ? styles.wheelActive : styles.wheelItem}>
            {v}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function AddSleep() {
  const { addSleep } = useSleep();

  const [sleep, setSleep] = useState({ hour: 11, minute: '00', period: 'pm' });
  const [wake, setWake] = useState({ hour: 7, minute: '00', period: 'am' });
  const [editing, setEditing] = useState('sleep');
  const [notes, setNotes] = useState('');

  // duration, wrapping past midnight
  const start = toMinutes(sleep);
  const end = toMinutes(wake);
  const total = end >= start ? end - start : end + 1440 - start;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  const current = editing === 'sleep' ? sleep : wake;
  const setCurrent = editing === 'sleep' ? setSleep : setWake;

  const format = ({ hour, minute, period }) => `${hour} : ${minute} ${period}`;

  const pad = ({ hour, minute, period }) => {
    let h = hour % 12;
    if (period === 'pm') h += 12;
    return `${String(h).padStart(2, '0')}:${minute}`;
  };

  const handleAdd = () => {
    addSleep({
      date: new Date().toISOString().split('T')[0],
      hours,
      minutes,
      sleepTime: pad(sleep),
      wakeTime: pad(wake),
      notes,
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

        <Text style={styles.title}>Add Sleep Data</Text>
        <Text style={styles.subtitle}>Insert your sleep data for today</Text>

        {/* Time summary */}
        <View style={styles.timeRow}>
          <View style={styles.timeBlock}>
            <Text style={styles.label}>Sleep Time</Text>
            <TouchableOpacity
              style={[styles.timeBox, editing === 'sleep' && styles.timeBoxActive]}
              onPress={() => setEditing('sleep')}
            >
              <Text style={styles.timeText}>{format(sleep)}</Text>
            </TouchableOpacity>
          </View>

          <Ionicons name="arrow-forward" size={22} color="#48DDB0" style={{ marginTop: 20 }} />

          <View style={styles.timeBlock}>
            <Text style={styles.label}>Wake Up Time</Text>
            <TouchableOpacity
              style={[styles.timeBox, editing === 'wake' && styles.timeBoxActive]}
              onPress={() => setEditing('wake')}
            >
              <Text style={styles.timeText}>{format(wake)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Wheels */}
        <View style={styles.wheelRow}>
          <TimeColumn
            values={HOURS}
            selected={current.hour}
            onSelect={(hour) => setCurrent({ ...current, hour })}
          />
          <TimeColumn
            values={MINUTES}
            selected={current.minute}
            onSelect={(minute) => setCurrent({ ...current, minute })}
          />
          <TimeColumn
            values={PERIODS}
            selected={current.period}
            onSelect={(period) => setCurrent({ ...current, period })}
          />
        </View>

        {/* Total */}
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total Sleep Duration:</Text>
          <Text style={styles.totalValue}>
            {hours}<Text style={styles.totalUnit}> h </Text>
            {minutes}<Text style={styles.totalUnit}> min</Text>
          </Text>
        </View>

        {/* Notes */}
        <Text style={styles.label}>
          Notes <Text style={styles.optional}>(Optional)</Text>
        </Text>
        <TextInput
          style={styles.notesField}
          placeholder="Describe your feelings or sleep experience..."
          placeholderTextColor="#60766E"
          multiline
          value={notes}
          onChangeText={setNotes}
        />

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
  },

  subtitle: {
    color: '#3AA889',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 20,
  },

  label: {
    color: '#D4E6DF',
    fontSize: 11,
    marginBottom: 6,
    paddingHorizontal: 25,
  },

  optional: { color: '#60766E', fontSize: 9 },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    marginBottom: 16,
  },

  timeBlock: { flex: 1 },

  timeBox: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },

  timeBoxActive: { borderColor: '#48DDB0' },

  timeText: { color: '#fff', fontSize: 14 },

  wheelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    height: 130,
    marginBottom: 20,
  },

  wheel: { maxWidth: 60 },

  wheelItem: {
    color: '#3A5049',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 6,
  },

  wheelActive: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
  },

  totalBox: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 25,
    marginBottom: 20,
  },

  totalLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },

  totalValue: { color: '#4ECBA0', fontSize: 22, fontFamily: 'serif' },

  totalUnit: { fontSize: 12, color: '#4ECBA0' },

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
    marginTop: 50,
  },

  submitText: { color: '#00382B', fontSize: 15, fontWeight: '600' },
});