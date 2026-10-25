import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/contexts/subscription-context';
import { api, toLogDate } from '@/services/api';
import { INSIGHTS } from '@/src/insights';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Placeholder aspects the model doesn't cover — sleep and activity aren't inputs. */
const PLACEHOLDER_INSIGHTS = INSIGHTS.filter(
  (i) => !/diet|nutrition|food/i.test(i.aspect)
);

export default function Insights() {
  const { token } = useAuth();

  // Read from the subscriptions table rather than a client-side flag.
  const { isPremium } = useSubscription();

  const [rec, setRec] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('simple');

  // Feedback state
  const [feedback, setFeedback] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState({});

  // "Not helpful" reason prompt
  const [reasonTarget, setReasonTarget] = useState(null);
  const [reasonText, setReasonText] = useState('');

  const loadRecommendation = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const today = await api.getTodaysRecommendation(token, toLogDate());
      setRec(today);
      /**
       * Restore any rating this user already gave, so a revisit doesn't show
       * the recommendation as unrated. Keyed on history_id — recommendation_id
       * identifies the kind of advice and is shared across users.
       */
      if (today?.history_id != null) {
        try {
          const mine = await api.listMyFeedback(token);
          const match = mine.find(
            (f) => f.recommendation_ref === today.history_id && f.domain === 'diet'
          );

          if (match) {
            setFeedback((prev) => ({ ...prev, diet: match.rating }));
            setFeedbackMessage((prev) => ({
              ...prev,
              diet:
                match.rating === 'up'
                  ? 'Thanks! Glad this recommendation was helpful.'
                  : 'Thanks for your feedback. We’ll use it to improve recommendations.',
            }));
          }
        } catch {
          // Not worth surfacing — the recommendation itself still loaded.
        }
      }
    } catch (err) {
      setError(err?.message ?? 'Could not load your recommendation.');
      setRec(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadRecommendation();
    }, [loadRecommendation])
  );

  const openInsight = (insight) => {
    setMode('simple');
    setSelected(insight);
  };

  /**
   * Only the diet card comes from the model, so only its rating can be
   * stored. The placeholder cards have no history_id to key on and stay
   * local until their aspects are model-backed too.
   */
  const isStorable = (key) => key === 'diet' && rec?.history_id != null;

  /**
   * Records feedback for one recommendation. Thumbs down arrives here only
   * after the user has given a reason — the server rejects an unexplained
   * negative, since it gives a Platform Manager nothing to act on.
   */
  const giveFeedback = async (recommendationId, type, reason = '') => {
    setFeedback((prev) => ({ ...prev, [recommendationId]: type }));

    setFeedbackMessage((prev) => ({
      ...prev,
      [recommendationId]:
        type === 'up'
          ? 'Thanks! Glad this recommendation was helpful.'
          : 'Thanks for your feedback. We’ll use it to improve recommendations.',
    }));

    if (!token || !isStorable(recommendationId)) return;

    try {
      await api.submitRecommendationFeedback(token, {
        recommendation_ref: rec.history_id,
        rating: type,
        domain: 'diet',
        reason: reason.trim() || null,
      });
    } catch (err) {
      // Roll the button back rather than showing a rating that didn't save.
      setFeedback((prev) => {
        const next = { ...prev };
        delete next[recommendationId];
        return next;
      });
      setFeedbackMessage((prev) => ({
        ...prev,
        [recommendationId]:
          err?.message ?? 'Could not save your feedback. Please try again.',
      }));
    }
  };

  /** Removes the recorded feedback, so a mis-tap can be undone. */
  const clearFeedback = async (recommendationId) => {
    const previous = feedback[recommendationId];

    setFeedback((prev) => {
      const next = { ...prev };
      delete next[recommendationId];
      return next;
    });

    setFeedbackMessage((prev) => {
      const next = { ...prev };
      delete next[recommendationId];
      return next;
    });

    if (!token || !isStorable(recommendationId)) return;

    try {
      await api.withdrawRecommendationFeedback(token, rec.history_id, 'diet');
    } catch (err) {
      // Put it back, so the button matches what the server holds.
      setFeedback((prev) => ({ ...prev, [recommendationId]: previous }));
      setFeedbackMessage((prev) => ({
        ...prev,
        [recommendationId]:
          err?.message ?? 'Could not withdraw your feedback. Please try again.',
      }));
    }
  };

  /** Toggles thumbs up — a second tap on an active button clears it. */
  const toggleUp = (recommendationId) => {
    if (feedback[recommendationId] === 'up') {
      clearFeedback(recommendationId);
      return;
    }
    giveFeedback(recommendationId, 'up');
  };

  /** Toggles thumbs down; asks for a reason only when switching it on. */
  const toggleDown = (recommendationId) => {
    if (feedback[recommendationId] === 'down') {
      clearFeedback(recommendationId);
      return;
    }
    setReasonText('');
    setReasonTarget(recommendationId);
  };

  const submitReason = () => {
    giveFeedback(reasonTarget, 'down', reasonText.trim());
    setReasonTarget(null);
  };

  /** Placeholder cards keep their own reasoning fields. */
  const reasoning =
    selected && !selected.fromApi
      ? (mode === 'technical' ? selected.reasoningTechnical : selected.reasoningSimple) ?? []
      : [];

  /** Biggest contributors first — that's the point of the SHAP ordering. */
  const factors = rec
    ? [...rec.factors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    : [];

  const maxContribution = factors.length
    ? Math.max(...factors.map((f) => Math.abs(f.contribution)))
    : 1;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>

        {/* HEADER */}
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

        {/* TITLE */}
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Insights</Text>

            <Text style={styles.date}>
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              {', '}
              {new Date().toLocaleTimeString('en-GB', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>

          <TouchableOpacity
            style={isPremium ? styles.refreshButton : styles.refreshDisabled}
            disabled={!isPremium || isLoading}
            onPress={loadRecommendation}
          >
            {!isPremium && (
              <Ionicons name="lock-closed" size={11} color="#3A5049" />
            )}

            <Text style={isPremium ? styles.refreshText : styles.refreshTextDisabled}>
              Refresh Insight
            </Text>
          </TouchableOpacity>
        </View>

        {/* =====================================================
            DIET & NUTRITION
        ===================================================== */}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Diet &amp; Nutrition</Text>

          {isLoading && !rec && (
            <ActivityIndicator
              size="small"
              color="#4ECBA0"
              style={{ marginVertical: 20 }}
            />
          )}

          {error && !isLoading && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {rec && (
            <>
              <Text style={styles.cardLabel}>Observations</Text>

              {rec.explanation.map((line, i) => (
                <View key={i} style={styles.obsRow}>
                  <Ionicons name="alert-circle" size={11} color="#E0A33F" />
                  <Text style={styles.obsText}>{line}</Text>
                </View>
              ))}

              <Text style={styles.cardLabel}>Conclusion</Text>
              <Text style={styles.conclusion}>{rec.recommendation}</Text>

              <TouchableOpacity
                style={styles.explainButton}
                onPress={() =>
                  openInsight({ fromApi: true, aspect: 'Diet & Nutrition' })
                }
              >
                <Text style={styles.explainText}>
                  Click here to view full explanation
                </Text>
              </TouchableOpacity>
            </>
          )}

          {!rec && !isLoading && !error && (
            <Text style={styles.conclusion}>
              Log some meals today and your recommendation will appear here.
            </Text>
          )}
        </View>

        {/* =====================================================
            OTHER INSIGHTS
        ===================================================== */}

        {PLACEHOLDER_INSIGHTS.map((insight) => (
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
              <Text style={styles.explainText}>
                Click here to view full explanation
              </Text>
            </TouchableOpacity>
          </View>
        ))}

      </ScrollView>

      {/* =====================================================
          FULL EXPLANATION POPUP
      ===================================================== */}

      <Modal visible={selected !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <ScrollView
            style={styles.modalCard}
            contentContainerStyle={{ padding: 20 }}
          >

            {/* =================================================
                AI RECOMMENDATION POPUP
            ================================================= */}

            {selected?.fromApi && rec ? (
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

                    <Text style={styles.confidence}>
                      Confidence: {Math.round(rec.confidence * 100)}%
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalTitle}>{rec.recommendation}</Text>

                {/* DATA USED */}
                <Text style={styles.modalLabel}>Data Used</Text>
                <View style={styles.rule} />

                {factors.map((f) => (
                  <Text key={f.feature} style={styles.modalBody}>
                    • {f.label}: {f.value}
                  </Text>
                ))}

                {/* REASONING */}
                <Text style={styles.modalLabel}>Reasoning</Text>
                <View style={styles.rule} />

                {mode === 'technical' && isPremium ? (
                  <>
                    <Text style={styles.modalNote}>
                      Each bar shows how much that value pushed the model toward
                      or away from this recommendation.
                    </Text>

                    {factors.map((f) => {
                      const width =
                        (Math.abs(f.contribution) / maxContribution) * 100;
                      const pushes = f.contribution >= 0;

                      return (
                        <View key={f.feature} style={styles.factorRow}>
                          <Text style={styles.factorLabel} numberOfLines={1}>
                            {f.label}
                          </Text>

                          <View style={styles.factorTrack}>
                            <View
                              style={[
                                styles.factorFill,
                                {
                                  width: `${width}%`,
                                  backgroundColor: pushes ? '#4ECBA0' : '#D9433F',
                                },
                              ]}
                            />
                          </View>

                          <Text style={styles.factorValue}>
                            {f.contribution > 0 ? '+' : ''}
                            {f.contribution.toFixed(3)}
                          </Text>
                        </View>
                      );
                    })}
                  </>
                ) : (
                  rec.explanation.map((step, i) => (
                    <Text key={i} style={styles.modalBody}>
                      {i + 1}. {step}
                    </Text>
                  ))
                )}

                {/* RECOMMENDATION */}
                <Text style={styles.modalLabel}>Recommendation</Text>
                <View style={styles.rule} />
                <Text style={styles.modalBody}>{rec.recommendation}</Text>

                {/* ALTERNATIVE */}
                {rec.alternative && (
                  <Text style={styles.modalFooter}>
                    Alternative: {rec.alternative.recommendation} (
                    {Math.round(rec.alternative.confidence * 100)}% confidence)
                  </Text>
                )}

                {/* FEEDBACK */}
                <View style={styles.feedbackContainer}>
                  <Text style={styles.feedbackQuestion}>
                    Was this recommendation helpful?
                  </Text>

                  <View style={styles.feedbackButtons}>
                    <TouchableOpacity
                      style={[
                        styles.feedbackButton,
                        feedback.diet === 'up' && styles.feedbackButtonSelected,
                      ]}
                      onPress={() => toggleUp('diet')}
                    >
                      <Ionicons
                        name={
                          feedback.diet === 'up'
                            ? 'thumbs-up'
                            : 'thumbs-up-outline'
                        }
                        size={20}
                        color={feedback.diet === 'up' ? '#020D09' : '#48DDB0'}
                      />

                      <Text
                        style={[
                          styles.feedbackText,
                          feedback.diet === 'up' && styles.feedbackTextSelected,
                        ]}
                      >
                        Helpful
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.feedbackButton,
                        feedback.diet === 'down' && styles.feedbackButtonSelected,
                      ]}
                      onPress={() => toggleDown('diet')}
                    >
                      <Ionicons
                        name={
                          feedback.diet === 'down'
                            ? 'thumbs-down'
                            : 'thumbs-down-outline'
                        }
                        size={20}
                        color={feedback.diet === 'down' ? '#020D09' : '#E07A5F'}
                      />

                      <Text
                        style={[
                          styles.feedbackText,
                          feedback.diet === 'down' && styles.feedbackTextSelected,
                        ]}
                      >
                        Not helpful
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {feedbackMessage.diet && (
                    <Text style={styles.feedbackMessage}>
                      {feedbackMessage.diet}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelected(null)}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : selected ? (

              /* =================================================
                  PLACEHOLDER INSIGHT POPUP
              ================================================= */

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

                    <Text style={styles.confidence}>
                      Confidence: {selected.confidence}%
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalTitle}>{selected.title}</Text>
                <Text style={styles.modalSummary}>{selected.summary}</Text>

                {/* OBSERVATION */}
                <Text style={styles.modalLabel}>Observation</Text>
                <View style={styles.rule} />
                <Text style={styles.modalBody}>{selected.observation}</Text>

                {/* DATA USED */}
                <Text style={styles.modalLabel}>Data Used</Text>
                <View style={styles.rule} />

                {selected.dataUsed.map((d, i) => (
                  <Text key={i} style={styles.modalBody}>• {d}</Text>
                ))}

                {/* REASONING */}
                <Text style={styles.modalLabel}>Reasoning</Text>
                <View style={styles.rule} />

                {reasoning.map((step, i) => (
                  <Text key={i} style={styles.modalBody}>
                    {i + 1}. {step}
                  </Text>
                ))}

                {/* RECOMMENDATION */}
                <Text style={styles.modalLabel}>Recommendation</Text>
                <View style={styles.rule} />
                <Text style={styles.modalBody}>{selected.recommendation}</Text>

                {/* FOOTER */}
                {selected.footer !== '' && (
                  <Text style={styles.modalFooter}>{selected.footer}</Text>
                )}

                {/* FEEDBACK */}
                <View style={styles.feedbackContainer}>
                  <Text style={styles.feedbackQuestion}>
                    Was this recommendation helpful?
                  </Text>

                  <View style={styles.feedbackButtons}>
                    <TouchableOpacity
                      style={[
                        styles.feedbackButton,
                        feedback[selected.id] === 'up' &&
                          styles.feedbackButtonSelected,
                      ]}
                      onPress={() => toggleUp(selected.id)}
                    >
                      <Ionicons
                        name={
                          feedback[selected.id] === 'up'
                            ? 'thumbs-up'
                            : 'thumbs-up-outline'
                        }
                        size={20}
                        color={
                          feedback[selected.id] === 'up' ? '#020D09' : '#48DDB0'
                        }
                      />

                      <Text
                        style={[
                          styles.feedbackText,
                          feedback[selected.id] === 'up' &&
                            styles.feedbackTextSelected,
                        ]}
                      >
                        Helpful
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.feedbackButton,
                        feedback[selected.id] === 'down' &&
                          styles.feedbackButtonSelected,
                      ]}
                      onPress={() => toggleDown(selected.id)}
                    >
                      <Ionicons
                        name={
                          feedback[selected.id] === 'down'
                            ? 'thumbs-down'
                            : 'thumbs-down-outline'
                        }
                        size={20}
                        color={
                          feedback[selected.id] === 'down' ? '#020D09' : '#E07A5F'
                        }
                      />

                      <Text
                        style={[
                          styles.feedbackText,
                          feedback[selected.id] === 'down' &&
                            styles.feedbackTextSelected,
                        ]}
                      >
                        Not helpful
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {feedbackMessage[selected.id] && (
                    <Text style={styles.feedbackMessage}>
                      {feedbackMessage[selected.id]}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelected(null)}
                >
                  <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : null}

          </ScrollView>
        </View>
      </Modal>

      {/* =====================================================
          "NOT HELPFUL" REASON PROMPT
      ===================================================== */}

      <Modal visible={reasonTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.reasonCard}>
            <Text style={styles.reasonTitle}>What didn&apos;t work?</Text>

            <Text style={styles.reasonHelper}>
              Tell us what was wrong with this recommendation. This helps us
              improve how recommendations are generated and explained.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="e.g. the explanation was hard to follow, or the advice didn't match what I ate..."
              placeholderTextColor="#60766E"
              multiline
              maxLength={500}
              value={reasonText}
              onChangeText={setReasonText}
              autoFocus
            />

            <Text style={styles.reasonCount}>{reasonText.length}/500</Text>

            <View style={styles.reasonButtons}>
              <TouchableOpacity
                style={styles.reasonCancel}
                onPress={() => setReasonTarget(null)}
              >
                <Text style={styles.reasonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  reasonText.trim().length >= 3
                    ? styles.reasonSubmit
                    : styles.reasonSubmitDisabled
                }
                disabled={reasonText.trim().length < 3}
                onPress={submitReason}
              >
                <Text
                  style={
                    reasonText.trim().length >= 3
                      ? styles.reasonSubmitText
                      : styles.reasonSubmitTextDisabled
                  }
                >
                  Submit
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
  container: {
    flex: 1,
    backgroundColor: '#020D09',
  },

  /* =========================================================
     HEADER
  ========================================================= */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingVertical: 16,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  logoBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#48DDB0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoGlyph: {
    fontSize: 15,
    color: '#00382B',
  },

  logo: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: '#123B2F',
  },

  /* =========================================================
     TITLE
  ========================================================= */

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 25,
    paddingTop: 20,
    marginBottom: 16,
  },

  title: {
    color: '#fff',
    fontSize: 32,
    fontFamily: 'serif',
  },

  date: {
    color: '#3AA889',
    fontSize: 10,
    marginTop: 4,
  },

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

  refreshText: {
    color: '#00382B',
    fontSize: 11,
    fontWeight: '600',
  },

  refreshTextDisabled: {
    color: '#3A5049',
    fontSize: 11,
    fontWeight: '600',
  },

  /* =========================================================
     CARDS
  ========================================================= */

  card: {
    backgroundColor: '#07140F',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 25,
    marginBottom: 12,
  },

  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'serif',
    marginBottom: 10,
  },

  cardLabel: {
    color: '#D4E6DF',
    fontSize: 10,
    marginTop: 8,
    marginBottom: 5,
  },

  obsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },

  obsText: {
    color: '#C7A03A',
    fontSize: 10,
    flex: 1,
  },

  conclusion: {
    color: '#60766E',
    fontSize: 9,
    lineHeight: 13,
  },

  errorText: {
    color: '#E07A5F',
    fontSize: 10,
    marginVertical: 10,
  },

  /* =========================================================
     EXPLAIN BUTTON
  ========================================================= */

  explainButton: {
    backgroundColor: '#0E2A20',
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 12,
  },

  explainText: {
    color: '#48DDB0',
    fontSize: 10,
  },

  /* =========================================================
     POPUP
  ========================================================= */

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

  modalAspect: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'serif',
  },

  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },

  modeToggle: {
    flexDirection: 'row',
    gap: 10,
  },

  mode: {
    color: '#3A5049',
    fontSize: 9,
  },

  modeActive: {
    color: '#48DDB0',
    fontSize: 9,
    fontWeight: '600',
  },

  confidence: {
    color: '#60766E',
    fontSize: 9,
  },

  modalTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },

  modalSummary: {
    color: '#D4E6DF',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 6,
  },

  modalLabel: {
    color: '#D4E6DF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 14,
  },

  rule: {
    height: 1,
    backgroundColor: '#123B2F',
    marginVertical: 5,
  },

  modalBody: {
    color: '#A5C4B8',
    fontSize: 9,
    lineHeight: 14,
  },

  modalNote: {
    color: '#60766E',
    fontSize: 8,
    lineHeight: 12,
    marginBottom: 8,
  },

  /* =========================================================
     SHAP FACTORS
  ========================================================= */

  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },

  factorLabel: {
    color: '#A5C4B8',
    fontSize: 8,
    width: 78,
  },

  factorTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#0E2A20',
    borderRadius: 3,
  },

  factorFill: {
    height: 6,
    borderRadius: 3,
  },

  factorValue: {
    color: '#60766E',
    fontSize: 7,
    width: 40,
    textAlign: 'right',
  },

  modalFooter: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 16,
  },

  /* =========================================================
     FEEDBACK
  ========================================================= */

  feedbackContainer: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#123B2F',
  },

  feedbackQuestion: {
    color: '#60766E',
    fontSize: 9,
    marginBottom: 10,
  },

  feedbackButtons: {
    flexDirection: 'row',
    gap: 8,
  },

  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#123B2F',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  feedbackButtonSelected: {
    backgroundColor: '#48DDB0',
    borderColor: '#48DDB0',
  },

  feedbackText: {
    color: '#A5C4B8',
    fontSize: 9,
  },

  feedbackTextSelected: {
    color: '#020D09',
    fontWeight: '600',
  },

  feedbackMessage: {
    color: '#60766E',
    fontSize: 8,
    marginTop: 8,
    lineHeight: 12,
  },

  /* =========================================================
     "NOT HELPFUL" REASON PROMPT
  ========================================================= */

  reasonCard: {
    backgroundColor: '#07140F',
    borderRadius: 14,
    padding: 20,
  },

  reasonTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'serif',
  },

  reasonHelper: {
    color: '#60766E',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 6,
    marginBottom: 16,
  },

  reasonInput: {
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderRadius: 10,
    padding: 12,
    height: 110,
    textAlignVertical: 'top',
    color: '#fff',
    fontSize: 11,
    lineHeight: 16,
  },

  reasonCount: {
    color: '#3A5049',
    fontSize: 8,
    textAlign: 'right',
    marginTop: 6,
  },

  reasonButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },

  reasonCancel: {
    flex: 1,
    backgroundColor: '#0A1A14',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  reasonCancelText: {
    color: '#fff',
    fontSize: 12,
  },

  reasonSubmit: {
    flex: 1,
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  reasonSubmitDisabled: {
    flex: 1,
    backgroundColor: '#123B2F',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },

  reasonSubmitText: {
    color: '#00382B',
    fontSize: 12,
    fontWeight: '600',
  },

  reasonSubmitTextDisabled: {
    color: '#3A5049',
    fontSize: 12,
    fontWeight: '600',
  },

  /* =========================================================
     CLOSE
  ========================================================= */

  closeButton: {
    backgroundColor: '#4ECBA0',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 40,
  },

  closeText: {
    color: '#00382B',
    fontSize: 13,
    fontWeight: '600',
  },
});