import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
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
          <TextInput
            style={styles.input}
            placeholder="example123@gmail.com"
            placeholderTextColor="#3A5049"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John"
                placeholderTextColor="#3A5049"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
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
            placeholder="••••••••••"
            placeholderTextColor="#3A5049"
          />

          <Text style={styles.label}>New Password</Text>
          <TextInput
            secureTextEntry
            style={styles.input}
            placeholder="At least 8 characters"
            placeholderTextColor="#3A5049"
          />

          <Text style={styles.label}>Re-type New Password</Text>
          <TextInput
            secureTextEntry
            style={styles.input}
            placeholder="••••••••••"
            placeholderTextColor="#3A5049"
          />
        </View>

        {/* Save */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/account/account')}
        >
          <Text style={styles.buttonText}>Save Changes</Text>
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

  row: { flexDirection: 'row', gap: 12 },

  field: { flex: 1 },

  /* Save */

  button: {
    backgroundColor: '#4ECBA0',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginHorizontal: 25,
    marginTop: 10,
  },

  buttonText: {
    color: '#00382B',
    fontSize: 14,
    fontWeight: '600',
  },
});