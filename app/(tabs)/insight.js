import { useProfile } from '@/contexts/profile-context';
import { INSIGHTS } from '@/src/insights';
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

export default function Insights() {
  const { profile } = useProfile();
  const isPremium = profile.plan === 'premium';

  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('simple');

  const openInsight = (insight) => {
    setMode('simple');
    setSelected(insight);
  };

  const reasoning =
    selected && mode === 'technical'
      ? selected.reasoningTechnical
      : selected?.reasoningSimple ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>

        <View style={styles.header}>
          <Text style={styles.logo}>✦ Knowtrients</Text>
          <TouchableOpacity onPress={() => router.push('/account/account')}>
            <Ionicons name="person-circle" size={32} color="#48DDB0" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Insights</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
              {', '}
              {new Date().toLocaleTimeString('en-GB', {
                hour: 'numeric', minute: '2-digit',
              })}
            </Text>
          </View>

          <TouchableOpacity
            style={isPremium ? styles.refreshButton : styles.refreshDisabled}
            disabled={!isPremium}
          >
            {!isPremium && (
              <Ionicons name="lock-closed" size={11} color="#3A5049" />
            )}
            <Text style={isPremium ? styles.refreshText : styles.refreshTextDisabled}>
              Refresh Insight
            </Text>
          </TouchableOpacity>
        </View>

        {/* Aspect cards */}
        {INSIGHTS.map((insight) => (
          <View key={insight.id} style={styles.card}>
            <Text style={styles.cardTitle}>{insight.aspect}</Text>

            <Text style={styles.cardLabel}>Observations</Text>

            {insight.observations.map((obs, i) => (
              <View key={i} style={styles.obsRow}>
                <Ionicons
                  name={obs.icon === 'alert' ? 'alert-circle' : 'warning'}
                  size={11}
                  color={obs.icon === 'alert' ? '#E0A33F' : '#C7A03A'}
                />
                <Text style={styles.obsText}>{obs.text}</Text>
              </View>
            ))}

            {insight.conclusion !== '' && (
              <>
                <Text style={styles.cardLabel}>Conclusion</Text>
                <Text style={styles.conclusion}>{insight.conclusion}</Text>
              </>
            )}

            <TouchableOpacity
              style={styles.explainButton}
              onPress={() => openInsight(insight)}
            >
              <Text style={styles.explainText}>Click here to view full explanation</Text>
            </TouchableOpacity>
          </View>
        ))}

      </ScrollView>

      {/* Popup */}
      <Modal visible={selected !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <ScrollView
            style={styles.modalCard}
            contentContainerStyle={{ padding: 20 }}
          >
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalAspect}>{selected.aspect}</Text>

                  <View style={styles.headerRight}>
                  {isPremium && (
                    <View style={styles.modeToggle}>
                      {['simple', 'technical'].map((m) => (
                        <TouchableOpacity key={m} onPress={() => setMode(m)}>
                          <Text style={mode === m ? styles.modeActive : styles.mode}>
                            {m === 'simple' ? 'Simple' : 'Technical'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <Text style={styles.confidence}>Confidence: {selected.confidence}%</Text>
                  </View>
                </View>

                <Text style={styles.modalTitle}>{selected.title}</Text>
                <Text style={styles.modalSummary}>{selected.summary}</Text>

                <Text style={styles.modalLabel}>Observation</Text>
                <View style={styles.rule} />
                <Text style={styles.modalBody}>{selected.observation}</Text>

                <Text style={styles.modalLabel}>Data Used</Text>
                <View style={styles.rule} />
                {selected.dataUsed.map((d, i) => (
                  <Text key={i} style={styles.modalBody}>• {d}</Text>
                ))}

                <Text style={styles.modalLabel}>Reasoning</Text>
                <View style={styles.rule} />
                {reasoning.map((step, i) => (
                  <Text key={i} style={styles.modalBody}>{i + 1}. {step}</Text>
                ))}

                <Text style={styles.modalLabel}>Recommendation</Text>
                <View style={styles.rule} />
                <Text style={styles.modalBody}>{selected.recommendation}</Text>

                {selected.footer !== '' && (
                  <Text style={styles.modalFooter}>{selected.footer}</Text>
                )}

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelected(null)}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
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

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: 20,
    marginBottom: 16,
  },

  title: { color: '#fff', fontSize: 32, fontFamily: 'serif' },
  date: { color: '#3AA889', fontSize: 10, marginTop: 4 },

  refreshButton: {
    backgroundColor: '#48DDB0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  refreshDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#123B2F',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  refreshText: { color: '#00382B', fontSize: 11, fontWeight: '600' },
  refreshTextDisabled: { color: '#3A5049', fontSize: 11, fontWeight: '600' },

  card: {
    backgroundColor: '#07140F',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  cardTitle: { color: '#fff', fontSize: 15, fontFamily: 'serif', marginBottom: 10 },

  cardLabel: { color: '#D4E6DF', fontSize: 10, marginTop: 8, marginBottom: 5 },

  obsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  obsText: { color: '#C7A03A', fontSize: 10 },

  conclusion: { color: '#60766E', fontSize: 9, lineHeight: 13 },

  explainButton: {
    backgroundColor: '#0E2A20',
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 12,
  },

  explainText: { color: '#48DDB0', fontSize: 10 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    backgroundColor: '#07140F',
    borderRadius: 14,
    maxHeight: '85%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  modalAspect: { color: '#fff', fontSize: 15, fontFamily: 'serif' },

  modeToggle: { flexDirection: 'row', gap: 10 },
  mode: { color: '#3A5049', fontSize: 9 },
  modeActive: { color: '#48DDB0', fontSize: 9, fontWeight: '600' },

  modalTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 12 },

  modalSummary: { color: '#D4E6DF', fontSize: 10, lineHeight: 14, marginTop: 6 },

  modalLabel: { color: '#D4E6DF', fontSize: 10, fontWeight: '600', marginTop: 14 },

  rule: { height: 1, backgroundColor: '#123B2F', marginVertical: 5 },

  modalBody: { color: '#A5C4B8', fontSize: 9, lineHeight: 14 },

  modalFooter: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 16 },

  closeButton: {
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 40,
  },

  closeText: { color: '#00382B', fontSize: 13, fontWeight: '600' },
  headerRight: { alignItems: 'flex-end', gap: 4 },

confidence: { color: '#60766E', fontSize: 9 },
});