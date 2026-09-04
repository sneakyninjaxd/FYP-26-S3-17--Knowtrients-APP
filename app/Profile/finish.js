import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
export default function CreateAccount() {
    const insets = useSafeAreaInsets();
  return (
  <View style={styles.container}>

    {/* Logo and tagline */}
    <View style={styles.logoContainer}>
      <Text style={styles.logo}>✦ Knowtrients</Text>
    </View>
    <View style={styles.content}>
      <Text style={styles.title}>You Are All Set!</Text>
      <Text style={styles.description}>
        You may edit the information in the settings
      </Text>
    </View>    

    {/* Continue button */}
    <TouchableOpacity
      style={[styles.button, { marginBottom: insets.bottom + 20 }]}
      onPress={() => router.push('/homepage')}
    >
      <Text style={styles.buttonText}>Continue</Text>
    </TouchableOpacity>

  </View>
);
}

const styles = StyleSheet.create({
  
  title: {
    color: '#fff',
    fontSize: 30,
    textAlign: 'center',
    fontFamily: 'serif',
  },

  description: {
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 25,
  },

  button: {
    backgroundColor: '#48DDB0',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
    width: 130,
    alignSelf: 'center',
  },

  buttonText: {
    color: '#00382B',
    fontSize: 14,
  },
  content: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 40,
},
  container: {
    flex: 1,
    backgroundColor: '#020D09',
  },

  logoContainer: {
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'serif',
  },
});

