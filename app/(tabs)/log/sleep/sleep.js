import { useSleep } from '@/contexts/sleep-context';
import { toLogDate } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

/** 7.5 → { h: 7, m: 30 }. The API stores one decimal, not an h/m pair. */
const splitHours = (value) => {
  const total = Math.round((value ?? 0) * 60);
  return { h: Math.floor(total / 60), m: total % 60 };
};

/** Days between a past date and today, for sizing the history fetch. */
const daysAgo = (date) => {
  const ms = new Date(toLogDate()).getTime() - new Date(toLogDate(date)).getTime();
  return Math.max(0, Math.round(ms / 86400000));
};

export default function Sleep() {
  const { sleepLogs, loadSleep } = useSleep();
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  // Pick up anything added on the add-sleep screen before we navigated back.
  useFocusEffect(
    useCallback(() => {
      loadSleep(7);
    }, [loadSleep])
  );

  /**
   * Selecting an older date needs history the default 7-day window doesn't
   * cover, so widen the fetch to reach it (plus the week shown in the chart).
   */
  const selectDate = (selected) => {
    setDate(selected);
    loadSleep(Math.min(daysAgo(selected) + 7, 90));
  };

  const key = toLogDate(date);
  const todayLog = sleepLogs.find((s) => s.log_date === key);
  const duration = todayLog ? splitHours(todayLog.hours) : null;

  // last 7 days ending on the selected date, oldest first
  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(date);
        d.setDate(d.getDate() - (6 - i));
        const dKey = toLogDate(d);
        const log = sleepLogs.find((s) => s.log_date === dKey);

        return {
          label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
          value: log?.hours ?? 0,
        };
      }),
    [sleepLogs, date]
  );

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
              if (selected) selectDate(selected);
            }}
          />
        )}

        {/* Selected day's sleep card */}
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
            {duration
              ? <>{duration.h}<Text style={styles.unit}> h </Text>{duration.m}<Text style={styles.unit}> m</Text></>
              : <>--<Text style={styles.unit}> h </Text>--<Text style={styles.unit}> m</Text></>}
          </Text>

          {todayLog?.bedtime && todayLog?.wake_time && (
            <Text style={styles.times}>
              {todayLog.bedtime} → {todayLog.wake_time}
            </Text>
          )}

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

  times: { color: '#60766E', fontSize: 10, marginTop: 4 },

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