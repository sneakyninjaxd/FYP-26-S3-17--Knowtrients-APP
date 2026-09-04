import { brand } from '@/constants/brand';
import { ApiError, useAuth } from '@/contexts/auth-context';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [retypePassword, setRetypePassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateAccount() {
    setError(null);

    if (!email || !firstName || !lastName || !password || !retypePassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== retypePassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signUp({ email, firstName, lastName, password, retypePassword });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoGlyph}>✦</Text>
          </View>
          <Text style={styles.brandName}>Knowtrients</Text>
          <Text style={styles.tagline}>Know your nutrients, Know your health</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Enter your details to continue</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Text style={styles.label}>Email:</Text>
          <TextInput
            style={styles.input}
            placeholder="example123@gmail.com"
            placeholderTextColor={brand.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>First Name:</Text>
              <TextInput
                style={styles.input}
                placeholder="John"
                placeholderTextColor={brand.textMuted}
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Last Name:</Text>
              <TextInput
                style={styles.input}
                placeholder="Doe"
                placeholderTextColor={brand.textMuted}
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <Text style={styles.label}>Password:</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••••"
            placeholderTextColor={brand.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>Retype Password:</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••••"
            placeholderTextColor={brand.textMuted}
            value={retypePassword}
            onChangeText={setRetypePassword}
            secureTextEntry
          />

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleCreateAccount}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={brand.accentText} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Have an account? </Text>
            <Link href="/(auth)/login" replace>
              <Text style={styles.footerLink}>Login!</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: brand.background },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 56 },
  header: { alignItems: 'center', marginBottom: 24 },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoGlyph: { fontSize: 22, color: brand.accentText },
  brandName: { fontSize: 28, fontWeight: '600', color: brand.textPrimary },
  tagline: { fontSize: 13, color: brand.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: brand.cardBackground,
    borderRadius: 20,
    padding: 24,
  },
  title: { fontSize: 26, fontWeight: '700', color: brand.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: 13,
    color: brand.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  errorText: {
    color: brand.error,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  label: { fontSize: 13, color: brand.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: brand.inputBackground,
    borderWidth: 1,
    borderColor: brand.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: brand.textPrimary,
    fontSize: 14,
  },
  button: {
    backgroundColor: brand.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: brand.accentText, fontSize: 15, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: brand.textSecondary, fontSize: 13 },
  footerLink: { color: brand.accent, fontSize: 13, fontWeight: '600' },
});
