import { useProfile } from '@/contexts/profile-context';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Finish() {
  const { updateProfile } = useProfile();
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    await updateProfile({ onboarding_complete: true });
    setSaving(false);
    router.replace('/homepage');
  };

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.logoContainer}>
        <Text style={styles.logo}>✦ Knowtrients</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>You Are All Set!</Text>
        <Text style={styles.description}>
          You may edit the information in the settings
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleContinue}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Continue'}
        </Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020D09' },

  logoContainer: {
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: { color: '#fff', fontSize: 28, fontFamily: 'serif' },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  title: {
    color: '#fff',
    fontSize: 30,
    textAlign: 'center',
    fontFamily: 'serif',
  },

  description: {
    color: '#ccc',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },

  button: {
    backgroundColor: '#48DDB0',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    width: 130,
    alignSelf: 'center',
    marginBottom: 40,
  },

  buttonText: { color: '#00382B', fontSize: 14, fontWeight: '600' },
});