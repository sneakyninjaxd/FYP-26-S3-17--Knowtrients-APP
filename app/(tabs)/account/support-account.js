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
 * The server enforces these category values; anything else comes back 422.
 * `bug_report` lives on the other form.
 */
const ISSUES = [
  { id: 'password', label: 'Password' },
  { id: 'account', label: 'Account' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'account-others', label: 'others' },
];

export default function AccountSupport() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [issue, setIssue] = useState(null);
  const [showIssues, setShowIssues] = useState(false);
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  // The API needs a body of at least 3 characters.
  const canSubmit = issue !== null && description.trim().length >= 3;

  const selectedLabel = ISSUES.find((i) => i.id === issue)?.label;

  const submit = async () => {
    if (!token || !canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createSupportRequest(token, {
        category: issue,
        subject: selectedLabel ?? 'Account support',
        body: description.trim(),
      });
      setSent(created.display_id ?? `#${created.id}`);
    } catch (err) {
      setError(err?.message ?? 'Could not send your request. Please try again.');
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

          <Text style={styles.title}>Account Support</Text>
          <Text style={styles.subtitle}>
            For issues regarding your account (e.g. Password / login issue,
            Account deactivation etc.)
          </Text>

          {sent ? (
            <View style={styles.sentCard}>
              <Ionicons name="checkmark-circle" size={28} color="#4ECBA0" />
              <Text style={styles.sentTitle}>Request sent</Text>
              <Text style={styles.sentBody}>
                Your reference is {sent}. We&apos;ll get back to you as soon as
                we can — you can check for a reply under Previous Requests.
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
                Let us know what issues you are currently facing...
              </Text>

              <TouchableOpacity
                style={styles.select}
                onPress={() => setShowIssues(!showIssues)}
              >
                <Text style={issue ? styles.selectValue : styles.selectPlaceholder}>
                  {selectedLabel ?? 'Select Issue'}
                </Text>
                <Ionicons
                  name={showIssues ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#48DDB0"
                />
              </TouchableOpacity>

              {showIssues && (
                <View style={styles.selectMenu}>
                  {ISSUES.map((i) => (
                    <TouchableOpacity
                      key={i.id}
                      onPress={() => {
                        setIssue(i.id);
                        setShowIssues(false);
                      }}
                      style={styles.selectOption}
                    >
                      <Text
                        style={
                          issue === i.id
                            ? styles.selectOptionTextActive
                            : styles.selectOptionText
                        }
                      >
                        {i.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>
                Describe your issue so that we can help you better...
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
                    {submitting ? 'Sending…' : 'Submit Request'}
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
    width: 200,
  },

  selectPlaceholder: { color: '#3A5049', fontSize: 12 },
  selectValue: { color: '#fff', fontSize: 12 },

  selectMenu: {
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingVertical: 4,
    marginHorizontal: 25,
    marginTop: 6,
    width: 200,
  },

  selectOption: { paddingVertical: 9, paddingHorizontal: 14 },
  selectOptionText: { color: '#D4E6DF', fontSize: 12 },
  selectOptionTextActive: { color: '#48DDB0', fontSize: 12, fontWeight: '600' },

  textArea: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    padding: 14,
    height: 150,
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

  footer: { marginTop: 'auto', paddingTop: 40 },

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