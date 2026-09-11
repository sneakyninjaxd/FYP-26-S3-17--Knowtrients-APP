import { useAuth } from '@/contexts/auth-context';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const REASONS = [
  'I found a better app',
  "I just don't feeling like using this app anymore",
  "I don't find Knowtrients useful",
  'Other',
];

const BUG_AREAS = [
  { id: 'logging', label: 'Logging' },
  { id: 'insights', label: 'Insights' },
  { id: 'profile', label: 'Profile' },
  { id: 'account', label: 'Account' },
  { id: 'other', label: 'Other' },
];

export default function Account() {
  const insets = useSafeAreaInsets();
  const { logOut, token } = useAuth();

  const [showDelete, setShowDelete] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [otherReason, setOtherReason] = useState('');

  const [showBugReport, setShowBugReport] = useState(false);
  const [bugArea, setBugArea] = useState(null);
  const [bugDescription, setBugDescription] = useState('');
  const [submittingBug, setSubmittingBug] = useState(false);
  const [bugError, setBugError] = useState(null);
  const [bugSent, setBugSent] = useState(null);

  const toggleReason = (item) => {
    setReasons((prev) =>
      prev.includes(item) ? prev.filter((r) => r !== item) : [...prev, item]
    );
  };

  const openBugReport = () => {
    setBugArea(null);
    setBugDescription('');
    setBugError(null);
    setBugSent(null);
    setShowBugReport(true);
  };

  // The API needs a body of at least 3 characters.
  const canSubmitBug = bugArea !== null && bugDescription.trim().length >= 3;

  /**
   * Lands in the admin request queue. The form has no subject field, so one
   * is derived from the selected area.
   */
  const submitBug = async () => {
    if (!token || !canSubmitBug || submittingBug) return;

    setSubmittingBug(true);
    setBugError(null);
    try {
      const area = BUG_AREAS.find((a) => a.id === bugArea);
      const created = await api.createSupportRequest(token, {
        category: 'bug_report',
        subject: `Bug report — ${area?.label ?? 'Other'}`,
        body: bugDescription.trim(),
      });
      setBugSent(created.display_id ?? `#${created.id}`);
    } catch (err) {
      setBugError(err?.message ?? 'Could not send your report. Please try again.');
    } finally {
      setSubmittingBug(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 + insets.bottom }}>

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

        <Text style={styles.title}>Account</Text>
        <Text style={styles.description}>
          Update your account details &amp; settings
        </Text>

        <TouchableOpacity
          style={styles.activityBox}
          onPress={() => router.push('/account/accountdetails')}
        >
          <Text style={styles.activity}>Account Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.activityBox}
          onPress={() => router.push('/account/subscription')}
        >
          <Text style={styles.activity}>Subscription</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.activityBox} onPress={openBugReport}>
          <Text style={styles.activity}>Report a Bug</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.activityBox2}
          onPress={() => setShowDelete(true)}
        >
          <Text style={styles.activity2}>Delete Account</Text>
        </TouchableOpacity>

        {/* might need to end session and log out user after deleting account */}
        <TouchableOpacity style={styles.activityBox3} onPress={logOut}>
          <Text style={styles.activity3}>Log out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Delete account modal */}
      <Modal visible={showDelete} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>We will miss you :(</Text>
            <Text style={styles.modalSubtitle}>Let us know why you are leaving...</Text>
            <Text style={styles.modalHelper}>
              Select all that apply. This helps Knowtrients to do better the next
              time you return.
            </Text>

            {REASONS.map((item) => {
              const selected = reasons.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  onPress={() => toggleReason(item)}
                  style={[styles.reasonBox, selected && styles.reasonBoxActive]}
                >
                  <Text style={selected ? styles.reasonTextActive : styles.reasonText}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {reasons.includes('Other') && (
              <TextInput
                style={styles.reasonInput}
                placeholder="Describe your experience with Knowtrients..."
                placeholderTextColor="#60766E"
                value={otherReason}
                onChangeText={setOtherReason}
              />
            )}

            <Text style={styles.warning}>
              ALL YOUR DATA WILL BE DELETED AND IT CAN&apos;T BE RECOVERED. THIS
              ACTION IS NOT REVERSIBLE.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDelete(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteButton}>
                <Text style={styles.deleteText}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bug report modal */}
      <Modal visible={showBugReport} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Report a Bug</Text>

            {bugSent ? (
              <>
                <Text style={styles.modalHelper}>
                  Thanks — your report has been sent. Reference {bugSent}.
                </Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={() => setShowBugReport(false)}
                  >
                    <Text style={styles.submitText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalHelper}>
                  Let us know what went wrong so we can fix it.
                </Text>

                <Text style={styles.fieldLabel}>Where did it happen?</Text>

                <View style={styles.chipWrap}>
                  {BUG_AREAS.map((area) => {
                    const active = bugArea === area.id;
                    return (
                      <TouchableOpacity
                        key={area.id}
                        onPress={() => setBugArea(area.id)}
                        style={active ? styles.chipActive : styles.chip}
                      >
                        <Text style={active ? styles.chipTextActive : styles.chipText}>
                          {area.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.bugInput}
                  placeholder="Describe what happened and what you expected..."
                  placeholderTextColor="#60766E"
                  multiline
                  maxLength={5000}
                  value={bugDescription}
                  onChangeText={setBugDescription}
                />

                {bugError && <Text style={styles.bugError}>{bugError}</Text>}

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setShowBugReport(false)}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      canSubmitBug && !submittingBug
                        ? styles.submitButton
                        : styles.submitDisabled
                    }
                    disabled={!canSubmitBug || submittingBug}
                    onPress={submitBug}
                  >
                    <Text style={canSubmitBug ? styles.submitText : styles.submitTextDisabled}>
                      {submittingBug ? 'Sending…' : 'Submit'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    color: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'serif',
    paddingHorizontal: 25,
    paddingTop: 20,
    marginBottom: 5,
  },

  description: {
    color: '#3AA889',
    fontSize: 12,
    paddingHorizontal: 25,
    marginBottom: 20,
  },

  activityBox: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  activity: { color: '#3AA889', fontSize: 13 },

  activityBox2: {
    borderWidth: 1,
    borderColor: '#921d1d',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  activity2: { color: '#921d1d', fontSize: 13 },

  activityBox3: {
    backgroundColor: '#ce3535',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginHorizontal: 25,
    marginTop: 80,
  },

  activity3: { color: '#faf7f7', fontSize: 13 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    backgroundColor: '#0B2119',
    borderRadius: 16,
    padding: 24,
  },

  modalTitle: { color: '#fff', fontSize: 24, fontFamily: 'serif' },
  modalSubtitle: { color: '#D4E6DF', fontSize: 13, marginTop: 4 },
  modalHelper: { color: '#60766E', fontSize: 11, marginTop: 8, marginBottom: 16 },

  fieldLabel: { color: '#D4E6DF', fontSize: 12, marginBottom: 10 },

  reasonBox: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  reasonBoxActive: { borderColor: '#48DDB0' },
  reasonText: { color: '#60766E', fontSize: 12 },
  reasonTextActive: { color: '#48DDB0', fontSize: 12 },

  reasonInput: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    marginTop: 4,
  },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },

  chip: {
    backgroundColor: '#102A21',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  chipActive: {
    backgroundColor: '#102A21',
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  chipText: { color: '#60766E', fontSize: 11 },
  chipTextActive: { color: '#48DDB0', fontSize: 11 },

  bugInput: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    padding: 12,
    height: 90,
    textAlignVertical: 'top',
    color: '#fff',
  },

  bugError: { color: '#E07A5F', fontSize: 11, marginTop: 10 },

  warning: { color: '#E05555', fontSize: 11, marginVertical: 16 },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },

  cancelButton: {
    flex: 1,
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  cancelText: { color: '#fff', fontSize: 14 },

  deleteButton: {
    flex: 1,
    backgroundColor: '#E0453F',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  deleteText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  submitButton: {
    flex: 1,
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  submitDisabled: {
    flex: 1,
    backgroundColor: '#123B2F',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },

  submitText: { color: '#00382B', fontSize: 14, fontWeight: '600' },
  submitTextDisabled: { color: '#3A5049', fontSize: 14, fontWeight: '600' },
});