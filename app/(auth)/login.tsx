import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth, ApiError } from '@/contexts/auth-context';
import { brand } from '@/constants/brand';

export default function LoginScreen() {
  const { logIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);

    if (!email || !password) {
      setError('Please fill in both fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await logIn({ email, password });
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
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>Enter your details to login</Text>

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

          <Text style={styles.label}>Password:</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••••"
            placeholderTextColor={brand.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={brand.accentText} />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </Pressable>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New here? </Text>
            <Link href="/(auth)/signup" replace>
              <Text style={styles.footerLink}>Create Account!</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: brand.background },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 64 },
  header: { alignItems: 'center', marginBottom: 32 },
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
    marginBottom: 24,
  },
  errorText: {
    color: brand.error,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
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
    marginTop: 28,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: brand.accentText, fontSize: 15, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: brand.textSecondary, fontSize: 13 },
  footerLink: { color: brand.accent, fontSize: 13, fontWeight: '600' },
});
