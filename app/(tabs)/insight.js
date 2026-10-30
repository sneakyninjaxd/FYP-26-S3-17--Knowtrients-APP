import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/contexts/subscription-context';
import { api, toLogDate } from '@/services/api';
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

/**
 * The three model-backed aspects, in the order they appear.
 *
 * There is no hardcoded fallback content any more — every card here comes
 * from a model, and an aspect with nothing to say shows its prompt rather
 * than invented advice.
 */
const MODEL_CARDS = [
  {
    domain: 'diet',
    aspect: 'Diet & Nutrition',
    emptyHint: 'Log some meals today and your recommendation will appear here.',
  },
  {
    domain: 'fitness',
    aspect: 'Activity',
    emptyHint: 'Log some activity and your recommendation will appear here.',
  },
  {
    domain: 'sleep',
    aspect: 'Sleep',
    emptyHint: 'Log a few nights and your recommendation will appear here.',
  },
];

/** "20–26 Oct" — the window a weekly recommendation was built from. */
const formatWindow = (start, end) => {
  if (!start || !end) return null;

  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;

  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString('en-GB',
    sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  const right = b.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return `${left}–${right}`;
};

export default function Insights() {
  const { token } = useAuth();

  // Read from the subscriptions table rather than a client-side flag.
  const { isPremium } = useSubscription();

  // Each aspect is its own model with its own history rows.
  const [rec, setRec] = useState(null);
  const [fitnessRec, setFitnessRec] = useState(null);
  const [sleepRec, setSleepRec] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fitnessError, setFitnessError] = useState(null);
  const [sleepError, setSleepError] = useState(null);

  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('simple');

  // Feedback state
  const [feedback, setFeedback] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState({});

  // "Not helpful" reason prompt
  const [reasonTarget, setReasonTarget] = useState(null);
  const [reasonText, setReasonText] = useState('');

  const thanksFor = (rating) =>
    rating === 'up'
      ? 'Thanks! Glad this recommendation was helpful.'
      : 'Thanks for your feedback. We’ll use it to improve recommendations.';

  const loadRecommendation = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);
    setFitnessError(null);
    setSleepError(null);

    // One failing model shouldn't blank the other cards.
    const [dietResult, fitnessResult, sleepResult] = await Promise.allSettled([
      api.getTodaysRecommendation(token, toLogDate()),
      api.getTodaysFitnessRecommendation(token),
      api.getTodaysSleepRecommendation(token),
    ]);

    const diet = dietResult.status === 'fulfilled' ? dietResult.value : null;
    const fitness = fitnessResult.status === 'fulfilled' ? fitnessResult.value : null;
    const sleep = sleepResult.status === 'fulfilled' ? sleepResult.value : null;

    setRec(diet);
    setFitnessRec(fitness);
    setSleepRec(sleep);

    if (dietResult.status === 'rejected') {
      setError(dietResult.reason?.message ?? 'Could not load your recommendation.');
    }
    if (fitnessResult.status === 'rejected') {
      setFitnessError(
        fitnessResult.reason?.message ?? 'Could not load your activity recommendation.'
      );
    }
    if (sleepResult.status === 'rejected') {
      setSleepError(
        sleepResult.reason?.message ?? 'Could not load your sleep recommendation.'
      );
    }

    /**
     * Restore any ratings this user already gave, so a revisit doesn't show
     * the recommendations as unrated. Keyed on history_id — recommendation_id
     * identifies the kind of advice and is shared across users.
     */
    if (
      diet?.history_id != null ||
      fitness?.history_id != null ||
      sleep?.history_id != null
    ) {
      try {
        const mine = await api.listMyFeedback(token);

        const restore = (domain, historyId) => {
          if (historyId == null) return;
          const match = mine.find(
            (f) => f.recommendation_ref === historyId && f.domain === domain
          );
          if (!match) return;

          setFeedback((prev) => ({ ...prev, [domain]: match.rating }));
          setFeedbackMessage((prev) => ({
            ...prev,
            [domain]: thanksFor(match.rating),
          }));
        };

        restore('diet', diet?.history_id);
        restore('fitness', fitness?.history_id);
        restore('sleep', sleep?.history_id);
      } catch {
        // Not worth surfacing — the recommendations themselves still loaded.
      }
    }

    setIsLoading(false);
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
   * A rating can only be stored against a real recommendation, so the test
   * is simply whether this aspect came back with a history_id.
   */
  const recFor = (key) =>
    key === 'diet'
      ? rec
      : key === 'fitness'
        ? fitnessRec
        : key === 'sleep'
          ? sleepRec
          : null;

  const isStorable = (key) => recFor(key)?.history_id != null;

  const errorFor = (key) =>
    key === 'diet' ? error : key === 'fitness' ? fitnessError : sleepError;

  /**
   * How much of the window the advice rests on. `nights_logged` is exact and
   * worth saying plainly; `data_completeness` is the model's own coverage
   * figure, which is only worth showing when it's low enough to matter.
   */
  const coverageNote = (r) => {
    if (!r) return null;

    if (typeof r.nights_logged === 'number' && r.nights_logged > 0) {
      return `${r.nights_logged} of 7 nights`;
    }

    if (typeof r.data_completeness === 'number' && r.data_completeness < 0.99) {
      return `${Math.round(r.data_completeness * 100)}% of expected data`;
    }

    return null;
  };

  /**
   * Records feedback for one recommendation. Thumbs down arrives here only
   * after the user has given a reason — the server rejects an unexplained
   * negative, since it gives a Platform Manager nothing to act on.
   */
  const giveFeedback = async (recommendationId, type, reason = '') => {
    setFeedback((prev) => ({ ...prev, [recommendationId]: type }));

    setFeedbackMessage((prev) => ({
      ...prev,
      [recommendationId]: thanksFor(type),
    }));

    if (!token || !isStorable(recommendationId)) return;

    try {
      await api.submitRecommendationFeedback(token, {
        recommendation_ref: recFor(recommendationId).history_id,
        rating: type,
        domain: recommendationId,
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
      await api.withdrawRecommendationFeedback(
        token,
        recFor(recommendationId).history_id,
        recommendationId
      );
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

  /** Whichever model-backed card the modal is currently showing. */
  const activeRec = selected?.fromApi ? recFor(selected.domain) : null;

  /** Biggest contributors first — that's the point of the SHAP ordering. */
  const factors = activeRec?.factors
    ? [...activeRec.factors].sort(
        (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)
      )
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
            MODEL-BACKED ASPECTS — all three share one card, so a
            change to how recommendations read happens once.
        ===================================================== */}

        {MODEL_CARDS.map(({ domain, aspect, emptyHint }) => {
          const cardRec = recFor(domain);
          const cardError = errorFor(domain);

          return (
            <View key={domain} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{aspect}</Text>

                {/* How much of the window the advice is actually based on. */}
                {cardRec && coverageNote(cardRec) && (
                  <Text style={styles.coverage}>{coverageNote(cardRec)}</Text>
                )}
              </View>

              {isLoading && !cardRec && (
                <ActivityIndicator
                  size="small"
                  color="#4ECBA0"
                  style={{ marginVertical: 20 }}
                />
              )}

              {cardError && !isLoading && (
                <Text style={styles.errorText}>{cardError}</Text>
              )}

              {cardRec && (
                <>
                  <Text style={styles.cardLabel}>Observations</Text>

                  {(cardRec.explanation ?? []).map((line, i) => (
                    <View key={i} style={styles.obsRow}>
                      <Ionicons name="alert-circle" size={11} color="#E0A33F" />
                      <Text style={styles.obsText}>{line}</Text>
                    </View>
                  ))}

                  <Text style={styles.cardLabel}>Conclusion</Text>
                  <Text style={styles.conclusion}>{cardRec.recommendation}</Text>

                  {/* The one thing to actually do, where the model gives one. */}
                  {cardRec.next_step ? (
                    <View style={styles.nextStepRow}>
                      <Ionicons name="arrow-forward-circle" size={12} color="#4ECBA0" />
                      <Text style={styles.nextStepText}>{cardRec.next_step}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.explainButton}
                    onPress={() => openInsight({ fromApi: true, domain, aspect })}
                  >
                    <Text style={styles.explainText}>
                      Click here to view full explanation
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {!cardRec && !isLoading && !cardError && (
                <Text style={styles.conclusion}>{emptyHint}</Text>
              )}
            </View>
          );
        })}

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

            {selected?.fromApi && activeRec ? (
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
                      Confidence: {Math.round(activeRec.confidence * 100)}%
                    </Text>

                    {/* Which days the advice was built from. */}
                    {formatWindow(activeRec.window_start, activeRec.window_end) && (
                      <Text style={styles.windowText}>
                        {formatWindow(activeRec.window_start, activeRec.window_end)}
                      </Text>
                    )}
                  </View>
                </View>

                <Text style={styles.modalTitle}>{activeRec.recommendation}</Text>

                {/* A low coverage figure is the honest caveat on confidence. */}
                {coverageNote(activeRec) && (
                  <Text style={styles.coverageNote}>
                    Based on {coverageNote(activeRec)}
                  </Text>
                )}

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
                  (activeRec.explanation ?? []).map((step, i) => (
                    <Text key={i} style={styles.modalBody}>
                      {i + 1}. {step}
                    </Text>
                  ))
                )}

                {/* RECOMMENDATION */}
                <Text style={styles.modalLabel}>Recommendation</Text>
                <View style={styles.rule} />
                <Text style={styles.modalBody}>{activeRec.recommendation}</Text>

                {/* NEXT STEP */}
                {activeRec.next_step ? (
                  <>
                    <Text style={styles.modalLabel}>Your next step</Text>
                    <View style={styles.rule} />
                    <Text style={styles.modalBody}>{activeRec.next_step}</Text>
                  </>
                ) : null}

                {/* ALTERNATIVE */}
                {activeRec.alternative && (
                  <Text style={styles.modalFooter}>
                    Alternative: {activeRec.alternative.recommendation} (
                    {Math.round(activeRec.alternative.confidence * 100)}% confidence)
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
                        feedback[selected.domain] === 'up' &&
                          styles.feedbackButtonSelected,
                      ]}
                      onPress={() => toggleUp(selected.domain)}
                    >
                      <Ionicons
                        name={
                          feedback[selected.domain] === 'up'
                            ? 'thumbs-up'
                            : 'thumbs-up-outline'
                        }
                        size={20}
                        color={
                          feedback[selected.domain] === 'up' ? '#020D09' : '#48DDB0'
                        }
                      />

                      <Text
                        style={[
                          styles.feedbackText,
                          feedback[selected.domain] === 'up' &&
                            styles.feedbackTextSelected,
                        ]}
                      >
                        Helpful
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.feedbackButton,
                        feedback[selected.domain] === 'down' &&
                          styles.feedbackButtonSelected,
                      ]}
                      onPress={() => toggleDown(selected.domain)}
                    >
                      <Ionicons
                        name={
                          feedback[selected.domain] === 'down'
                            ? 'thumbs-down'
                            : 'thumbs-down-outline'
                        }
                        size={20}
                        color={
                          feedback[selected.domain] === 'down' ? '#020D09' : '#E07A5F'
                        }
                      />

                      <Text
                        style={[
                          styles.feedbackText,
                          feedback[selected.domain] === 'down' &&
                            styles.feedbackTextSelected,
                        ]}
                      >
                        Not helpful
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {feedbackMessage[selected.domain] && (
                    <Text style={styles.feedbackMessage}>
                      {feedbackMessage[selected.domain]}
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

  cardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },

  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'serif',
  },

  coverage: { color: '#60766E', fontSize: 8 },

  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
  },

  nextStepText: { color: '#4ECBA0', fontSize: 10, lineHeight: 14, flex: 1 },

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

  windowText: { color: '#3A5049', fontSize: 8 },

  coverageNote: {
    color: '#60766E',
    fontSize: 9,
    marginTop: 4,
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