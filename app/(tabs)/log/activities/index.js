import { useActivities } from '@/contexts/activity-context';
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
import Svg, { Circle } from 'react-native-svg';

const GOALS = { steps: 10000, calories: 500, activeTime: 90 };

/**
 * PLACEHOLDER — the backend has no steps field, so these are sample values
 * for demonstration. Replace with real data once a steps column exists.
 */
const SAMPLE_STEPS_TODAY = 6800;
const SAMPLE_STEPS_WEEK = [5000, 4000, 6000, 5000, 7000, 10000, 6800];

const MAX_STEPS = 10000;

const pct = (value, goal) => (goal > 0 ? Math.min((value / goal) * 100, 100) : 0);

function Ring({ percent, color, radius }) {
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <Circle
      cx="70" cy="70" r={radius}
      stroke={color} strokeWidth="12" fill="none"
      strokeDasharray={`${filled} ${circumference}`}
      strokeLinecap="round"
      transform="rotate(-90 70 70)"
    />
  );
}

function Bar({ label, value, goal, unit, color, sample }) {
  return (
    <View style={styles.barBlock}>
      <View style={styles.barTop}>
        <Text style={styles.barLabel}>
          {label}{sample ? <Text style={styles.sampleTag}> · sample</Text> : null}
        </Text>
        <Text style={styles.barValue}>
          {value}<Text style={styles.barGoal}>/{goal} {unit}</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct(value, goal)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function Activities() {
  const { activities, weekly, loadActivities, loadWeek, deleteActivity } = useActivities();
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  // Refetch on focus so entries added on the form show up.
  useFocusEffect(
    useCallback(() => {
      loadActivities(toLogDate(date));
      loadWeek(toLogDate(date));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadActivities, loadWeek])
  );

  const selectDate = (selected) => {
    setDate(selected);
    loadActivities(toLogDate(selected));
    loadWeek(toLogDate(selected));
  };

  const visible = activities;

  const activeTime = visible.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0);
  const caloriesBurnt = visible.reduce((sum, a) => sum + (a.calories_burned ?? 0), 0);

  const TODAY = {
    steps: SAMPLE_STEPS_TODAY,
    calories: Math.round(caloriesBurnt),
    activeTime: Math.round(activeTime),
  };

  /** Steps are sample values; minutes come from the API. */
  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(date);
        d.setDate(d.getDate() - (6 - i));
        const key = toLogDate(d);
        return {
          label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
          steps: SAMPLE_STEPS_WEEK[i],
          minutes: weekly?.[key] ?? 0,
        };
      }),
    [weekly, date]
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
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>My Activities</Text>
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

        {/* Daily Activities card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Svg width={140} height={140}>
              <Circle cx="70" cy="70" r="55" stroke="#123B2F" strokeWidth="12" fill="none" />
              <Circle cx="70" cy="70" r="40" stroke="#123B2F" strokeWidth="12" fill="none" />
              <Circle cx="70" cy="70" r="25" stroke="#123B2F" strokeWidth="12" fill="none" />

              <Ring percent={pct(TODAY.steps, GOALS.steps)} color="#48DDB0" radius={55} />
              <Ring percent={pct(TODAY.calories, GOALS.calories)} color="#2E8B7A" radius={40} />
              <Ring percent={pct(TODAY.activeTime, GOALS.activeTime)} color="#C77D3A" radius={25} />
            </Svg>

            <View style={styles.cardRight}>
              <Text style={styles.cardTitle}>Daily{'\n'}Activities</Text>

              <Bar label="Steps" value={TODAY.steps} goal={GOALS.steps}
                   unit="steps" color="#48DDB0" sample />
              <Bar label="Calories Burnt" value={TODAY.calories} goal={GOALS.calories}
                   unit="kcal" color="#2E8B7A" />
              <Bar label="Active Time" value={TODAY.activeTime} goal={GOALS.activeTime}
                   unit="mins" color="#C77D3A" />
            </View>
          </View>

          <Text
            style={styles.statsLink}
            onPress={() => router.push('/log/activities/statistics')}
          >
            View Overall Activities Statistics ›
          </Text>
        </View>

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Activities</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/log/activities/addactivities')}
          >
            <Text style={styles.addButtonText}>Add Activities</Text>
          </TouchableOpacity>
        </View>

        {/* Activity list */}
        {visible.map((a) => (
          <View key={a.id} style={styles.activityCard}>
            <View style={styles.activityTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityName}>{a.activity_type}</Text>
                {a.notes ? <Text style={styles.activityMeta}>{a.notes}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => deleteActivity(a.id)}>
                <Ionicons name="trash-outline" size={18} color="#60766E" />
              </TouchableOpacity>
            </View>

            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{a.duration_minutes} min</Text>
              </View>
              {a.intensity ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{a.intensity}</Text>
                </View>
              ) : null}
              {a.calories_burned ? (
                <View style={styles.tagActive}>
                  <Text style={styles.tagTextActive}>~{Math.round(a.calories_burned)} kcal</Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}

        {visible.length === 0 && (
          <Text style={styles.empty}>No activities logged yet.</Text>
        )}

        {/* Weekly steps chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            Steps over the last 7 days
            <Text style={styles.sampleTag}> · sample data</Text>
          </Text>

          <View style={styles.chartArea}>
            {[10000, 8000, 6000, 4000, 2000, 0].map((tick) => (
              <View key={tick} style={[styles.gridRow, { bottom: (tick / MAX_STEPS) * 140 + 24 }]}>
                <Text style={styles.gridLabel}>{tick / 1000}k</Text>
                <View style={styles.gridLine} />
              </View>
            ))}

            <View style={styles.chartRow}>
              {week.map((d) => (
                <View key={d.label} style={styles.chartColumn}>
                  <View
                    style={[
                      styles.chartBar,
                      { height: Math.min(d.steps / MAX_STEPS, 1) * 140 },
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

  title: { color: '#FFFFFF', fontSize: 32, fontFamily: 'serif' },

  date: { color: '#48DDB0', fontSize: 12, marginTop: 4 },

  card: {
    backgroundColor: '#07140F',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 25,
    marginBottom: 20,
  },

  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardRight: { flex: 1 },
  cardTitle: { color: '#fff', fontSize: 18, fontFamily: 'serif', marginBottom: 14 },

  statsLink: {
    color: '#60766E',
    fontSize: 9,
    textAlign: 'right',
    marginTop: 10,
  },

  barBlock: { marginBottom: 12 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  barLabel: { color: '#48DDB0', fontSize: 9 },
  barValue: { color: '#D4E6DF', fontSize: 9 },
  barGoal: { color: '#60766E', fontSize: 8 },
  barTrack: { height: 5, backgroundColor: '#123B2F', borderRadius: 3 },
  barFill: { height: 5, borderRadius: 3 },

  sampleTag: { color: '#60766E', fontSize: 8, fontStyle: 'italic' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    marginBottom: 12,
  },

  sectionTitle: { color: '#48DDB0', fontSize: 16, fontFamily: 'serif' },

  addButton: {
    backgroundColor: '#48DDB0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  addButtonText: { color: '#00382B', fontSize: 11, fontWeight: '600' },

  activityCard: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  activityTop: { flexDirection: 'row', justifyContent: 'space-between' },
  activityName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  activityMeta: { color: '#60766E', fontSize: 10, marginTop: 2 },

  tagRow: { flexDirection: 'row', gap: 8, marginTop: 12 },

  tag: {
    backgroundColor: '#102A21',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  tagText: { color: '#60766E', fontSize: 10 },

  tagActive: {
    backgroundColor: '#102A21',
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  tagTextActive: { color: '#48DDB0', fontSize: 10 },

  empty: {
    color: '#60766E',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 20,
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

  gridLabel: { color: '#60766E', fontSize: 10, width: 24, textAlign: 'right' },
  gridLine: { flex: 1, height: 1, backgroundColor: '#123B2F' },

  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 170,
    paddingLeft: 24,
  },

  chartColumn: { alignItems: 'center' },

  chartBar: { width: 18, backgroundColor: '#4ECBA0', borderRadius: 9 },

  chartLabel: { color: '#60766E', fontSize: 10, marginTop: 8 },
});