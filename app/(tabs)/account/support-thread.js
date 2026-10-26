/**
 * One support request and its conversation.
 *
 * Not live chat — messages are fetched when the screen opens, after sending,
 * and on pull-to-refresh. An admin reply appears the next time the user
 * opens the thread, which is what the API supports.
 */
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/** "12 Oct, 14:30" — enough to follow a conversation without clutter. */
const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

const STATUS_LABELS = {
  unresolved: 'Open',
  resolved: 'Resolved',
  in_progress: 'In progress',
};

export default function SupportThread() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { id } = useLocalSearchParams();

  const requestId = Number(id);

  const [thread, setThread] = useState(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null);

  /**
   * State updates are async, so two quick taps can both clear the `sending`
   * check before React re-renders and sends the message twice. A ref updates
   * immediately, which is what the guard actually needs.
   */
  const sendingRef = useRef(false);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!token || !Number.isFinite(requestId)) return;

      if (!silent) setIsLoading(true);
      try {
        setThread(await api.getSupportMessages(token, requestId));
        setError(null);
      } catch (err) {
        setError(err?.message ?? 'Could not load this conversation.');
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [token, requestId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  const send = async () => {
    const body = draft.trim();
    if (!token || body.length < 1 || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    setError(null);

    // Clear the box up front so a fast second tap has nothing left to send.
    setDraft('');

    try {
      await api.sendSupportMessage(token, requestId, body);
      await load({ silent: true });
      // Scrolling after the refetch means the new message is already laid out.
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch (err) {
      // Put the text back so it isn't lost to a failed send.
      setDraft(body);
      setError(err?.message ?? 'Could not send your message. Please try again.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const request = thread?.request;
  const messages = thread?.messages ?? [];
  const isResolved = request?.status === 'resolved';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
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

        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color="#48DDB0" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {request?.subject ?? 'Support request'}
            </Text>
            <Text style={styles.meta}>
              {request?.display_id ?? ''}
              {request?.category_label ? ` · ${request.category_label}` : ''}
            </Text>
          </View>

          {request && (
            <View style={[styles.statusPill, isResolved && styles.statusPillResolved]}>
              <Text style={[styles.statusText, isResolved && styles.statusTextResolved]}>
                {STATUS_LABELS[request.status] ?? request.status}
              </Text>
            </View>
          )}
        </View>

        {isLoading && !thread ? (
          <ActivityIndicator size="small" color="#4ECBA0" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor="#4ECBA0"
              />
            }
          >
            {/* The original request reads as the first message in the thread. */}
            {request && (
              <View style={[styles.bubble, styles.bubbleMine]}>
                <Text style={styles.bubbleText}>{request.body}</Text>
                <Text style={styles.bubbleTimeMine}>
                  {formatTime(request.created_at)}
                </Text>
              </View>
            )}

            {messages.map((m) => (
              <View
                key={m.id}
                style={[styles.bubble, m.is_mine ? styles.bubbleMine : styles.bubbleTheirs]}
              >
                {!m.is_mine && (
                  <Text style={styles.sender}>
                    {m.sender_name ?? 'Support'}
                  </Text>
                )}
                <Text style={styles.bubbleText}>{m.body}</Text>
                <Text style={m.is_mine ? styles.bubbleTimeMine : styles.bubbleTime}>
                  {formatTime(m.created_at)}
                </Text>
              </View>
            ))}

            {messages.length === 0 && (
              <Text style={styles.empty}>
                No reply yet. We&apos;ll get back to you as soon as we can —
                pull down to check for one.
              </Text>
            )}

            {isResolved && (
              <Text style={styles.resolvedNote}>
                This request has been marked resolved. You can still reply if
                something is unclear.
              </Text>
            )}
          </ScrollView>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={[styles.composer, { paddingBottom: 10 + insets.bottom }]}>
          <TextInput
            style={styles.input}
            placeholder="Write a message..."
            placeholderTextColor="#3A5049"
            multiline
            maxLength={5000}
            value={draft}
            onChangeText={setDraft}
          />

          <TouchableOpacity
            style={draft.trim() && !sending ? styles.sendButton : styles.sendDisabled}
            disabled={!draft.trim() || sending}
            onPress={send}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#00382B" />
            ) : (
              <Ionicons name="send" size={16} color={draft.trim() ? '#00382B' : '#3A5049'} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },

  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  meta: { color: '#60766E', fontSize: 10, marginTop: 2 },

  statusPill: {
    backgroundColor: '#1E1705',
    borderWidth: 1,
    borderColor: '#5C4A16',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  statusPillResolved: { backgroundColor: '#0E2A20', borderColor: '#48DDB0' },

  statusText: { color: '#E0A33F', fontSize: 9, fontWeight: '600' },
  statusTextResolved: { color: '#48DDB0' },

  messages: { padding: 20, paddingBottom: 10, gap: 12 },

  bubble: {
    maxWidth: '85%',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // The user's own messages sit right, the admin's left — the usual convention.
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#0E2A20',
    borderWidth: 1,
    borderColor: '#48DDB0',
    borderBottomRightRadius: 4,
  },

  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#07140F',
    borderWidth: 1,
    borderColor: '#123B2F',
    borderBottomLeftRadius: 4,
  },

  sender: { color: '#48DDB0', fontSize: 9, fontWeight: '600', marginBottom: 4 },

  bubbleText: { color: '#D4E6DF', fontSize: 12, lineHeight: 17 },

  bubbleTime: { color: '#3A5049', fontSize: 8, marginTop: 6 },
  bubbleTimeMine: { color: '#3A5049', fontSize: 8, marginTop: 6, textAlign: 'right' },

  empty: {
    color: '#60766E',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },

  resolvedNote: {
    color: '#60766E',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },

  error: {
    color: '#E07A5F',
    fontSize: 11,
    paddingHorizontal: 20,
    marginBottom: 6,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#123B2F',
  },

  input: {
    flex: 1,
    backgroundColor: '#0A1A14',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 12,
    lineHeight: 17,
    maxHeight: 110,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4ECBA0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendDisabled: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#123B2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
});