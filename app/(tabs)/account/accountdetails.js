import { useAuth } from '@/contexts/auth-context';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AccountDetailsScreen() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { token, user } = auth;

  // Seeded from the signed-in user, so the fields show what is stored rather
  // than placeholder text that looks like data.
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const nameChanged =
    firstName.trim() !== (user?.first_name ?? '') ||
    lastName.trim() !== (user?.last_name ?? '');

  const wantsPasswordChange =
    currentPassword.length > 0 || newPassword.length > 0 || retypePassword.length > 0;

  const save = async () => {
    if (!token || saving) return;

    setError(null);
    setNotice(null);

    // Validate before sending, so an obvious mistake doesn't need a round trip.
    if (nameChanged && (!firstName.trim() || !lastName.trim())) {
      setError('First and last name cannot be empty.');
      return;
    }

    if (wantsPasswordChange) {
      if (!currentPassword) {
        setError('Enter your current password to set a new one.');
        return;
      }
      if (newPassword.length < 8) {
        setError('The new password must be at least 8 characters.');
        return;
      }
      if (newPassword !== retypePassword) {
        setError('The new passwords do not match.');
        return;
      }
    }

    if (!nameChanged && !wantsPasswordChange) {
      setNotice('Nothing to save.');
      return;
    }

    setSaving(true);
    try {
      // Name first: if the password change then fails, the user is told, and
      // the part that succeeded is already stored rather than lost.
      if (nameChanged) {
        await api.updateMe(token, {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        });
      }

      if (wantsPasswordChange) {
        await api.changePassword(token, currentPassword, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setRetypePassword('');
      }

      // Pull the updated user back into the app if the context offers a way;
      // without it the new name would only appear after signing in again.
      if (typeof auth.refreshUser === 'function') {
        await auth.refreshUser();
      }

      router.push('/account/account');
    } catch (err) {
      setError(err?.message ?? 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>

        {/* Header */}
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

        <Text style={styles.title}>Account Details</Text>
        <Text style={styles.subtitle}>
          Update your account details &amp; settings
        </Text>

        {/* Personal details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={14} color="#48DDB0" />
            <Text style={styles.cardTitle}>Personal Details</Text>
          </View>

          <Text style={styles.label}>Email</Text>
          {/* Read-only: the email identifies the account and is where a
              password reset is sent, so it isn't editable. */}
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>{user?.email ?? '—'}</Text>
            <Ionicons name="lock-closed" size={12} color="#3A5049" />
          </View>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="John"
                placeholderTextColor="#3A5049"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                placeholderTextColor="#3A5049"
              />
            </View>
          </View>
        </View>

        {/* Security */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="lock-closed-outline" size={14} color="#48DDB0" />
            <Text style={styles.cardTitle}>Security</Text>
          </View>

          <Text style={styles.cardHint}>
            Leave these blank if you don&apos;t want to change your password.
          </Text>

          <Text style={styles.label}>Current Password</Text>
          <TextInput
            secureTextEntry
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••••"
            placeholderTextColor="#3A5049"
          />

          <Text style={styles.label}>New Password</Text>
          <TextInput
            secureTextEntry
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 8 characters"
            placeholderTextColor="#3A5049"
          />

          <Text style={styles.label}>Re-type New Password</Text>
          <TextInput
            secureTextEntry
            style={styles.input}
            value={retypePassword}
            onChangeText={setRetypePassword}
            placeholder="••••••••••"
            placeholderTextColor="#3A5049"
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        {/* Save */}
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#00382B" />
          ) : (
            <Text style={styles.buttonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020D09',
  },

  /* Header */

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

  /* Title */

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
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 20,
  },

  /* Cards */

  card: {
    backgroundColor: '#07140F',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 25,
    marginBottom: 14,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },

  cardTitle: {
    color: '#48DDB0',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  cardHint: {
    color: '#60766E',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 4,
  },

  /* Fields */

  label: {
    color: '#D4E6DF',
    fontSize: 11,
    marginTop: 16,
    marginBottom: 6,
  },

  input: {
    backgroundColor: '#00100B',
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 13,
  },

  /* A field that is shown but not editable — flatter than an input, so it
     doesn't invite a tap. */
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#00100B',
    borderWidth: 1,
    borderColor: '#0E2A20',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  readOnlyText: { color: '#60766E', fontSize: 13 },

  fieldHint: {
    color: '#3A5049',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 6,
  },

  row: { flexDirection: 'row', gap: 12 },

  field: { flex: 1 },

  /* Feedback */

  error: {
    color: '#E07A5F',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 6,
  },

  notice: {
    color: '#60766E',
    fontSize: 11,
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 6,
  },

  /* Save */

  button: {
    backgroundColor: '#4ECBA0',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 25,
    marginTop: 10,
  },

  buttonDisabled: { opacity: 0.6 },

  buttonText: {
    color: '#00382B',
    fontSize: 14,
    fontWeight: '600',
  },
});