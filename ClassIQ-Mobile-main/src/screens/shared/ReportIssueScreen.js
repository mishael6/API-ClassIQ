import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, FlatList, KeyboardAvoidingView, Platform,
  RefreshControl, Modal, ActivityIndicator, StatusBar, Animated, Alert,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import {
  fetchMyIssues,
  fetchIssueMessages,
  sendIssueReply,
  submitIssue,
} from '../../api/issues';
import { AppIcon } from '../../components/AppIcon';

// ── Helpers ──────────────────────────────────────────────────
const timeAgo = (dt) => {
  if (!dt) return '';
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const extractSubject = (message) => {
  if (!message) return 'No subject';
  if (message.startsWith('Subject:')) {
    const lines = message.split('\n');
    return lines[0].replace('Subject: ', '').trim();
  }
  return message.length > 50 ? message.substring(0, 50) + '…' : message;
};

const extractBody = (message) => {
  if (!message) return '';
  if (message.startsWith('Subject:')) {
    const lines = message.split('\n');
    return lines.slice(2).join('\n').trim();
  }
  return message;
};

const isStudentSender = (role) => {
  const r = (role || '').toLowerCase();
  return r === 'student' || r === 'user';
};

const isAdminSender = (role) => {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'classrep' || r === 'staff';
};

const POLL_THREAD_MS = 3000;
const POLL_LIST_MS = 10000;

const isIssueClosed = (status) => {
  const s = (status || '').toLowerCase();
  return s === 'closed';
};

const isIssueResolved = (status) => {
  const s = (status || '').toLowerCase();
  return s === 'resolved' || s === 'closed';
};

const messagesChanged = (prev, next) => {
  if (prev.length !== next.length) return true;
  return prev.some((m, i) => {
    const a = m.id ?? `${m.created_at}-${m.message}`;
    const b = next[i]?.id ?? `${next[i]?.created_at}-${next[i]?.message}`;
    return a !== b;
  });
};

// ── Status Badge ─────────────────────────────────────────────
const StatusBadge = ({ status, colors }) => {
  const s = (status || '').toLowerCase();
  const isResolved = s === 'resolved' || s === 'closed';
  const isActive = s === 'open' || s === 'in_progress' || s === 'answered';
  const color = isResolved ? '#10b981' : isActive ? '#3b82f6' : '#f59e0b';
  const label = isResolved ? 'Resolved' : isActive ? 'In progress' : 'Pending';
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════
export default function ReportIssueScreen({ navigation }) {
  const { colors } = useTheme();

  // ── State ────────────────────────────────────────────────────
  const [view, setView] = useState('list'); // 'list' | 'thread'
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [thread, setThread] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  // New issue modal
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState('student');
  const [live, setLive] = useState(false);

  const flatListRef = useRef();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pollRef = useRef(null);

  const ownSenderRole = userRole === 'classrep' ? 'classrep' : 'student';

  const isOwnMessage = (role) => {
    const r = (role || '').toLowerCase();
    if (userRole === 'classrep') return r === 'classrep';
    return r === 'student' || r === 'user';
  };

  // ── Load issues ──────────────────────────────────────────────
  const loadIssues = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const token = await authStore.getToken();
      const data = await fetchMyIssues(token);
      if (data?.success) {
        setIssues(data.issues || []);
      }
    } catch (e) {
      console.error('Load issues error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();
    authStore.getUser().then((u) => {
      if (u?.role === 'classrep' || u?.role === 'class_rep') setUserRole('classrep');
    });
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Poll issue list while on list view
  useEffect(() => {
    if (view !== 'list') return undefined;
    const id = setInterval(() => loadIssues(true), POLL_LIST_MS);
    return () => clearInterval(id);
  }, [view, loadIssues]);

  // Poll thread while in conversation
  useEffect(() => {
    if (view !== 'thread' || !selectedIssue?.id) {
      setLive(false);
      return undefined;
    }
    setLive(true);
    const poll = async () => {
      try {
        const token = await authStore.getToken();
        const data = await fetchIssueMessages(token, selectedIssue.id);
        if (data?.success) {
          setThread((prev) => {
            const next = data.messages || [];
            return messagesChanged(prev, next) ? next : prev;
          });
          if (data.issue) {
            setSelectedIssue((prev) => (prev ? { ...prev, ...data.issue } : prev));
          }
        }
      } catch {
        // silent — keep polling
      }
    };
    poll();
    pollRef.current = setInterval(poll, POLL_THREAD_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      setLive(false);
    };
  }, [view, selectedIssue?.id]);

  // ── Open issue thread ────────────────────────────────────────
  const applyThreadResponse = (data) => {
    if (!data?.success) return;
    setThread(data.messages || []);
    if (data.issue) {
      setSelectedIssue((prev) => (prev ? { ...prev, ...data.issue } : prev));
    }
  };

  const openIssue = async (issue) => {
    setSelectedIssue(issue);
    setView('thread');
    setThreadLoading(true);
    setThread([]);
    setReply('');
    try {
      const token = await authStore.getToken();
      const data = await fetchIssueMessages(token, issue.id);
      applyThreadResponse(data);
    } catch (e) {
      console.error('Load thread error:', e);
      Alert.alert('Error', 'Could not load this conversation. Pull down to retry.');
    } finally {
      setThreadLoading(false);
    }
  };

  const refreshThread = async (silent = false) => {
    if (!selectedIssue) return;
    if (!silent) setRefreshing(true);
    try {
      const token = await authStore.getToken();
      const data = await fetchIssueMessages(token, selectedIssue.id);
      applyThreadResponse(data);
    } catch (e) {
      console.error('Refresh thread error:', e);
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  // ── Send reply ───────────────────────────────────────────────
  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !selectedIssue || sending) return;

    setSending(true);
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: optimisticId,
      sender_role: ownSenderRole,
      message: text,
      created_at: new Date().toISOString(),
    };
    setThread((prev) => [...prev, optimisticMsg]);
    setReply('');

    try {
      const token = await authStore.getToken();
      const data = await sendIssueReply(token, selectedIssue.id, text);
      if (data?.success === false) {
        throw new Error(data.message || 'Could not send message.');
      }
      await refreshThread(true);
    } catch (e) {
      setThread((prev) => prev.filter((m) => m.id !== optimisticId));
      setReply(text);
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Could not send your message. Please try again.';
      Alert.alert('Send failed', msg);
    } finally {
      setSending(false);
    }
  };

  const submitNewIssue = async () => {
    if (!newSubject.trim() || !newMessage.trim()) return;
    setSubmitting(true);
    try {
      const token = await authStore.getToken();
      await submitIssue(token, {
        subject: newSubject.trim(),
        message: newMessage.trim(),
      });
      setNewSubject('');
      setNewMessage('');
      setShowNewIssue(false);
      loadIssues();
    } catch (e) {
      console.error('Submit issue error:', e);
      Alert.alert('Error', e?.response?.data?.message || 'Could not submit issue.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Back to list ─────────────────────────────────────────────
  const goBack = () => {
    setView('list');
    setSelectedIssue(null);
    setThread([]);
    setReply('');
    loadIssues();
  };

  const hasAdminReply = useMemo(
    () => thread.some((m) => isAdminSender(m.sender_role)),
    [thread]
  );

  const canReply = selectedIssue && !isIssueClosed(selectedIssue.status);

  const chatMessages = useMemo(() => {
    const original = {
      id: 'original',
      sender_role: ownSenderRole,
      message: extractBody(selectedIssue?.message),
      created_at: selectedIssue?.created_at,
      isOriginal: true,
    };
    const seen = new Set(['original']);
    const rest = thread.filter((m) => {
      const key = m.id != null ? String(m.id) : `${m.created_at}-${m.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [original, ...rest];
  }, [selectedIssue, thread, ownSenderRole]);

  // ═══════════════════════════════════════════════════════════════
  // ── RENDER: Issue List ─────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  if (view === 'list') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" />
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Support</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Report issues & get help from admin
            </Text>
          </View>

          {/* Issue list */}
          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading issues…</Text>
            </View>
          ) : issues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Issues Yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Tap the button below to report your first issue
              </Text>
            </View>
          ) : (
            <FlatList
              data={issues}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadIssues(true)} tintColor={colors.primary} />
              }
              renderItem={({ item }) => {
                const hasUnread = (item.unread_admin_replies || item.unread_count || 0) > 0;
                return (
                  <TouchableOpacity
                    style={[
                      styles.issueCard,
                      { backgroundColor: colors.surface, borderColor: hasUnread ? colors.primary : colors.border },
                      hasUnread && styles.issueCardUnread,
                    ]}
                    onPress={() => openIssue(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.issueCardTop}>
                      <Text style={[styles.issueSubject, { color: colors.text }]} numberOfLines={1}>
                        {extractSubject(item.message)}
                      </Text>
                      <Text style={[styles.issueTime, { color: colors.textSecondary }]}>
                        {timeAgo(item.created_at)}
                      </Text>
                    </View>
                    <Text style={[styles.issuePreview, { color: colors.textSecondary }]} numberOfLines={2}>
                      {extractBody(item.message)}
                    </Text>
                    <View style={styles.issueCardBottom}>
                      <StatusBadge status={item.status} colors={colors} />
                      {hasUnread && (
                        <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.unreadBadgeText}>{item.unread_admin_replies || item.unread_count}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* New Issue FAB */}
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => setShowNewIssue(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>＋</Text>
          </TouchableOpacity>

          {/* ── New Issue Modal ── */}
          <Modal visible={showNewIssue} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKav}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Report New Issue</Text>
                    <TouchableOpacity onPress={() => setShowNewIssue(false)}>
                      <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Subject</Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="Brief description of the issue"
                    placeholderTextColor={colors.textSecondary}
                    value={newSubject}
                    onChangeText={setNewSubject}
                  />

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Message</Text>
                  <TextInput
                    style={[styles.modalInput, styles.modalTextarea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="Describe the issue in detail…"
                    placeholderTextColor={colors.textSecondary}
                    value={newMessage}
                    onChangeText={setNewMessage}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
                    onPress={submitNewIssue}
                    disabled={submitting || !newSubject.trim() || !newMessage.trim()}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.submitBtnText}>Submit Issue</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ── RENDER: Chat Thread ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        {/* Thread Header */}
        <View style={[styles.threadHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.threadHeaderInfo}>
            <Text style={[styles.threadTitle, { color: colors.text }]} numberOfLines={1}>
              {extractSubject(selectedIssue?.message)}
            </Text>
            <StatusBadge status={selectedIssue?.status} colors={colors} />
            {live && (
              <View style={[styles.liveDot, { backgroundColor: colors.success + '22' }]}>
                <View style={[styles.livePulse, { backgroundColor: colors.success }]} />
                <Text style={[styles.liveText, { color: colors.success }]}>Live</Text>
              </View>
            )}
          </View>
        </View>

        {/* Messages */}
        {threadLoading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={chatMessages}
            keyExtractor={(item, index) => item.id?.toString() || index.toString()}
            contentContainerStyle={styles.chatList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refreshThread} tintColor={colors.primary} />
            }
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isUser = isOwnMessage(item.sender_role);
              return (
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAdmin]}>
                  {item.isOriginal && (
                    <Text style={[styles.bubbleLabel, { color: colors.textSecondary }]}>Original Issue</Text>
                  )}
                  {!isUser && !item.isOriginal && (
                    <Text style={[styles.bubbleLabel, { color: '#3b82f6' }]}>Admin</Text>
                  )}
                  {isUser && !item.isOriginal && (
                    <Text style={[styles.bubbleLabel, { color: colors.textSecondary }]}>You</Text>
                  )}
                  <View style={[
                    styles.bubbleInner,
                    isUser
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                  ]}>
                    <Text style={[styles.bubbleText, { color: isUser ? '#fff' : colors.text }]}>
                      {item.message}
                    </Text>
                  </View>
                  <Text style={[styles.bubbleTime, { color: colors.textSecondary }]}>
                    {timeAgo(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {hasAdminReply && canReply && (
          <Text style={[styles.replyHint, { color: colors.textSecondary, backgroundColor: colors.surfaceAlt }]}>
            Admin has replied — you can continue the conversation below.
          </Text>
        )}

        {/* Reply Box */}
        <View style={[styles.replyBox, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {canReply ? (
            <>
              <TextInput
                style={[styles.replyInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder={isIssueResolved(selectedIssue?.status) ? 'Reply to reopen this issue…' : 'Type your reply…'}
                placeholderTextColor={colors.textMuted}
                value={reply}
                onChangeText={setReply}
                editable={!sending}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: (!reply.trim() || sending) ? 0.5 : 1 }]}
                onPress={sendReply}
                disabled={!reply.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <AppIcon name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.closedNotice}>
              <AppIcon name="checkmark-circle-outline" size={20} color={colors.success} />
              <Text style={[styles.closedNoticeText, { color: colors.textSecondary }]}>
                This issue is closed. Open a new issue if you need more help.
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Styles ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },

  // ── Header ──
  header: {
    padding: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },

  // ── Issue List ──
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  issueCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  issueCardUnread: {
    borderWidth: 1.5,
  },
  issueCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  issueSubject: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  issueTime: {
    fontSize: 11,
  },
  issuePreview: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  issueCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ── Badge ──
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Loader ──
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
  },

  // ── New Issue Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalKav: {
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalClose: {
    fontSize: 22,
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  modalTextarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  submitBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // ── Thread Header ──
  threadHeader: {
    padding: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
  },
  threadHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  threadTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  liveDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginLeft: 8,
  },
  livePulse: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 10, fontWeight: '800' },

  // ── Chat Bubbles ──
  chatList: {
    padding: 16,
    paddingBottom: 8,
  },
  bubble: {
    marginBottom: 14,
    maxWidth: '82%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleAdmin: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubbleLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  bubbleInner: {
    padding: 12,
    borderRadius: 16,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
    paddingHorizontal: 4,
  },

  // ── Reply Box ──
  replyBox: {
    flexDirection: 'row',
    padding: 14,
    borderTopWidth: 1,
    alignItems: 'flex-end',
    gap: 10,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  replyHint: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 8,
  },
  closedNotice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  closedNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
