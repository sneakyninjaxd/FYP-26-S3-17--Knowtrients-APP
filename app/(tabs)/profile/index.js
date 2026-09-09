import { useProfile } from '@/contexts/profile-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const REPORT_SECTIONS = [
  { id: 'profile', label: 'My Profiles' },
  { id: 'progress', label: 'My Progress Data' },
];

export default function Profile() {
  const { profile } = useProfile();
  const isPremium = profile.plan === 'premium';

  const [showReport, setShowReport] = useState(false);
  const [selected, setSelected] = useState([]);

  const toggleSection = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const openReport = () => {
    setSelected([]);
    setShowReport(true);
  };

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

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

        {isPremium && (
          <TouchableOpacity style={styles.reportButton} onPress={openReport}>
            <Text style={styles.reportText}>Generate Health Report</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Health report modal */}
      <Modal visible={showReport} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>My Health Report</Text>
            <Text style={styles.modalDate}>Data will be as of {generatedAt}</Text>

            <Text style={styles.modalHelper}>
              Select what you wish to download. Select all that apply.
            </Text>

            {REPORT_SECTIONS.map((section) => {
              const checked = selected.includes(section.id);
              return (
                <TouchableOpacity
                  key={section.id}
                  onPress={() => toggleSection(section.id)}
                  style={[styles.optionBox, checked && styles.optionBoxActive]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <Text style={checked ? styles.optionTextActive : styles.optionText}>
                    {section.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowReport(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={selected.length ? styles.downloadButton : styles.downloadDisabled}
                disabled={selected.length === 0}
              >
                <Text style={selected.length ? styles.downloadText : styles.downloadTextDisabled}>
                  Download
                </Text>
              </TouchableOpacity>
            </View>
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

  reportButton: {
    backgroundColor: '#4ECBA0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 25,
    marginTop: 20,
  },

  reportText: { color: '#00382B', fontSize: 13, fontWeight: '600' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 25,
  },

  modalCard: {
    backgroundColor: '#07140F',
    borderRadius: 16,
    padding: 22,
  },

  modalTitle: { color: '#fff', fontSize: 20, fontFamily: 'serif' },

  modalDate: { color: '#D4E6DF', fontSize: 10, marginTop: 6 },

  modalHelper: {
    color: '#60766E',
    fontSize: 9,
    marginTop: 12,
    marginBottom: 12,
  },

  optionBox: {
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 20,
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginBottom: 10,
  },

  optionBoxActive: { borderColor: '#48DDB0' },

  optionText: { color: '#60766E', fontSize: 12 },
  optionTextActive: { color: '#48DDB0', fontSize: 12 },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },

  cancelButton: {
    flex: 1,
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  cancelText: { color: '#fff', fontSize: 13 },

  downloadButton: {
    flex: 1,
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  downloadDisabled: {
    flex: 1,
    backgroundColor: '#123B2F',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  downloadText: { color: '#00382B', fontSize: 13, fontWeight: '600' },
  downloadTextDisabled: { color: '#3A5049', fontSize: 13, fontWeight: '600' },
});