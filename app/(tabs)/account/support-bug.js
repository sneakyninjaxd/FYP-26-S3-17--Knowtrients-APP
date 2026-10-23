import { useAuth } from '@/contexts/auth-context';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Where the bug happened. The server's category is always `bug_report`, so
 * this goes into the subject line to help whoever triages the queue.
 */
const AREAS = [
  { id: 'logging', label: 'Logging food, sleep or activity' },
  { id: 'insights', label: 'Insights or recommendations' },
  { id: 'profile', label: 'Profile or goals' },
  { id: 'account', label: 'Account or login' },
  { id: 'bug-other', label: 'Others' },
];

export default function ReportBug() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [area, setArea] = useState(null);
  const [showAreas, setShowAreas] = useState(false);
  const [persisting, setPersisting] = useState(null);
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  // The API needs a body of at least 3 characters.
  const canSubmit =
    area !== null && persisting !== null && description.trim().length >= 3;

  const selectedLabel = AREAS.find((a) => a.id === area)?.label;

  /**
   * There's no field for "still persisting", so it's prefixed to the body
   * rather than lost — it's the first thing a triager wants to know.
   */
  const submit = async () => {
    if (!token || !canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const status = persisting ? 'Still happening' : 'No longer happening';
      const created = await api.createSupportRequest(token, {
        category: 'bug_report',
        subject: `Bug — ${selectedLabel ?? 'Somewhere else'}`,
        body: `[${status}]\n\n${description.trim()}`,
      });
      setSent(created.display_id ?? `#${created.id}`);
    } catch (err) {
      setError(err?.message ?? 'Could not send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 30 + insets.bottom, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >

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

          <Text style={styles.title}>Report a bug</Text>
          <Text style={styles.subtitle}>
            For issues regarding any technical difficulties you have
            encountered (e.g. Page Loading Error, Inaccurate AI model etc.)
          </Text>

          {sent ? (
            <View style={styles.sentCard}>
              <Ionicons name="checkmark-circle" size={28} color="#4ECBA0" />
              <Text style={styles.sentTitle}>Report sent</Text>
              <Text style={styles.sentBody}>
                Your reference is {sent}. Thanks — this helps us fix things
                faster. You can check for a reply under Previous Requests.
              </Text>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => router.back()}
              >
                <Text style={styles.submitText}>Back to Help Support</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.label}>
                Let us know what errors you have encountered...
              </Text>

              <TouchableOpacity
                style={styles.select}
                onPress={() => setShowAreas(!showAreas)}
              >
                <Text style={area ? styles.selectValue : styles.selectPlaceholder}>
                  {selectedLabel ?? 'Select Issue'}
                </Text>
                <Ionicons
                  name={showAreas ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#48DDB0"
                />
              </TouchableOpacity>

              {showAreas && (
                <View style={styles.selectMenu}>
                  {AREAS.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => {
                        setArea(a.id);
                        setShowAreas(false);
                      }}
                      style={styles.selectOption}
                    >
                      <Text
                        style={
                          area === a.id
                            ? styles.selectOptionTextActive
                            : styles.selectOptionText
                        }
                      >
                        {a.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Is this issue still persisting?</Text>

              <View style={styles.radioRow}>
                {[
                  { value: true, label: 'Yes' },
                  { value: false, label: 'No' },
                ].map((option) => {
                  const active = persisting === option.value;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      style={styles.radioOption}
                      onPress={() => setPersisting(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active && <View style={styles.radioDot} />}
                      </View>
                      <Text style={active ? styles.radioTextActive : styles.radioText}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>
                Please describe the error so that we can solve it faster...
              </Text>

              <TextInput
                style={styles.textArea}
                placeholder="Add description..."
                placeholderTextColor="#3A5049"
                multiline
                maxLength={5000}
                value={description}
                onChangeText={setDescription}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.footer}>
                <TouchableOpacity
                  style={
                    canSubmit && !submitting
                      ? styles.submitButton
                      : styles.submitDisabled
                  }
                  disabled={!canSubmit || submitting}
                  onPress={submit}
                >
                  <Text style={canSubmit ? styles.submitText : styles.submitTextDisabled}>
                    {submitting ? 'Sending…' : 'Submit Report'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
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

  title: {
    color: '#fff',
    fontSize: 32,
    fontFamily: 'serif',
    paddingHorizontal: 25,
    paddingTop: 20,
  },

  subtitle: {
    color: '#3AA889',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 24,
  },

  label: {
    color: '#D4E6DF',
    fontSize: 12,
    paddingHorizontal: 25,
    marginBottom: 10,
    marginTop: 14,
  },

  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 42,
    marginHorizontal: 25,
    width: 240,
  },

  selectPlaceholder: { color: '#3A5049', fontSize: 12 },
  selectValue: { color: '#fff', fontSize: 12, flex: 1 },

  selectMenu: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingVertical: 4,
    marginHorizontal: 25,
    marginTop: 6,
  },

  selectOption: { paddingVertical: 9, paddingHorizontal: 14 },
  selectOptionText: { color: '#D4E6DF', fontSize: 12 },
  selectOptionTextActive: { color: '#48DDB0', fontSize: 12, fontWeight: '600' },

  radioRow: {
    flexDirection: 'row',
    gap: 28,
    paddingHorizontal: 25,
  },

  radioOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  radio: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A5049',
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioActive: { borderColor: '#48DDB0' },

  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#48DDB0',
  },

  radioText: { color: '#60766E', fontSize: 12 },
  radioTextActive: { color: '#48DDB0', fontSize: 12 },

  textArea: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    padding: 14,
    height: 130,
    textAlignVertical: 'top',
    color: '#fff',
    fontSize: 12,
    lineHeight: 17,
    marginHorizontal: 25,
  },

  error: {
    color: '#E07A5F',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 12,
  },

  footer: { marginTop: 'auto', paddingTop: 36 },

  submitButton: {
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 60,
  },

  submitDisabled: {
    backgroundColor: '#123B2F',
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 60,
  },

  submitText: { color: '#00382B', fontSize: 14, fontWeight: '600' },
  submitTextDisabled: { color: '#3A5049', fontSize: 14, fontWeight: '600' },

  sentCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 14,
    padding: 24,
    marginHorizontal: 25,
    marginTop: 20,
  },

  sentTitle: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'serif',
    marginTop: 10,
  },

  sentBody: {
    color: '#60766E',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
});