import { useSleep } from '@/contexts/sleep-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAX_HOURS = 10;

export default function Sleep() {
  const { sleepLogs } = useSleep();
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const key = date.toISOString().split('T')[0];
  const todayLog = sleepLogs.find((s) => s.date === key);

  // last 7 days, oldest first
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(date);
    d.setDate(d.getDate() - (6 - i));
    const dKey = d.toISOString().split('T')[0];
    const log = sleepLogs.find((s) => s.date === dKey);

    return {
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      value: log ? log.hours + log.minutes / 60 : 0,
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>My Sleep</Text>
            <Text style={styles.date}>
              {date.toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </Text>
          </View>

          <TouchableOpacity onPress={() => setShowPicker(true)}>
            <Ionicons name="calendar-outline" size={26} color="#48DDB0" />
          </TouchableOpacity>
        </View>

        {showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            maximumDate={new Date()}
            onChange={(event, selected) => {
              setShowPicker(Platform.OS === 'ios');
              if (selected) setDate(selected);
            }}
          />
        )}

        {/* Today's sleep card */}
        <View style={styles.sleepCard}>
          <View style={styles.sleepCardTop}>
            <Text style={styles.sleepCardTitle}>Today&apos;s Sleep</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/log/sleep/addsleep')}
            >
              <Text style={styles.addButtonText}>Add Sleep Data</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.duration}>
            {todayLog
              ? <>{todayLog.hours}<Text style={styles.unit}> h </Text>{todayLog.minutes}<Text style={styles.unit}> m</Text></>
              : <>--<Text style={styles.unit}> h </Text>--<Text style={styles.unit}> m</Text></>}
          </Text>

          <Text
            style={styles.statsLink}
            onPress={() => router.push('/log/sleep/overallsleepstatistics')}
          >
            View Overall Sleep Statistics ›
          </Text>
        </View>

        {/* 7-day chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Sleep Duration over the last 7 days</Text>

          <View style={styles.chartArea}>
            {[10, 8, 6, 4, 2, 0].map((tick) => (
              <View key={tick} style={[styles.gridRow, { bottom: (tick / MAX_HOURS) * 140 + 24 }]}>
                <Text style={styles.gridLabel}>{tick}</Text>
                <View style={styles.gridLine} />
              </View>
            ))}

            <View style={styles.chartRow}>
              {week.map((d, i) => (
                <View key={i} style={styles.chartColumn}>
                  <View
                    style={[
                      styles.chartBar,
                      { height: Math.min(d.value / MAX_HOURS, 1) * 140 },
                    ]}
                  />
                  <Text style={styles.chartLabel}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

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
  divider: { height: 1, backgroundColor: '#123B2F' },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: 20,
    marginBottom: 16,
  },

  title: { color: '#fff', fontSize: 32, fontFamily: 'serif' },
  date: { color: '#48DDB0', fontSize: 12, marginTop: 4 },

  sleepCard: {
    backgroundColor: '#07140F',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 25,
    marginBottom: 20,
  },

  sleepCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sleepCardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },

  addButton: {
    backgroundColor: '#48DDB0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  addButtonText: { color: '#00382B', fontSize: 10, fontWeight: '600' },

  duration: {
    color: '#4ECBA0',
    fontSize: 38,
    fontFamily: 'serif',
    marginTop: 14,
  },

  unit: { fontSize: 20, color: '#4ECBA0' },

  statsLink: {
    color: '#60766E',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 12,
  },

  chartCard: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 25,
  },

  chartTitle: { color: '#fff', fontSize: 14, marginBottom: 20 },

  chartArea: { position: 'relative', height: 180 },

  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  gridLabel: { color: '#60766E', fontSize: 10, width: 16, textAlign: 'right' },
  gridLine: { flex: 1, height: 1, backgroundColor: '#123B2F' },

  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 170,
    paddingLeft: 22,
  },

  chartColumn: { alignItems: 'center' },

  chartBar: {
    width: 18,
    backgroundColor: '#4ECBA0',
    borderRadius: 9,
  },

  chartLabel: { color: '#60766E', fontSize: 10, marginTop: 8 },
});