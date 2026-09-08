import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function Profile() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />

        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>View your profile and goals here</Text>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/profile/information')}
        >
          <Text style={styles.rowText}>My Information</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/profile/goals')}
        >
          <Text style={styles.rowText}>My Goals</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/profile/lifestyle')}
        >
          <Text style={styles.rowText}>My Lifestyle Preferences</Text>
        </TouchableOpacity>

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
    paddingVertical: 20,
  },

  logo: { color: '#fff', fontSize: 20, fontFamily: 'serif' },

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
    paddingHorizontal: 25,
    marginTop: 4,
    marginBottom: 20,
  },

  row: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  rowText: { color: '#3AA889', fontSize: 13 },
});