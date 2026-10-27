import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Alert, Animated } from 'react-native';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  SafeAreaView, ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import { BASE_URL } from '../../api/auth';
import { AppIcon } from '../../components/AppIcon';
import AIResponseRenderer from '../../components/AIResponseRenderer';

const MODES = [
  { key: 'explain', icon: 'bulb-outline', label: 'Explain', emoji: '📖' },
  { key: 'mcq', icon: 'help-circle-outline', label: 'Quiz', emoji: '📝' },
  { key: 'flashcard', icon: 'albums-outline', label: 'Cards', emoji: '🃏' },
  { key: 'fill', icon: 'create-outline', label: 'Blanks', emoji: '✏️' },
];

const QUICK_START = [
  { label: '📖 Explain topic', mode: 'explain', hint: 'Paste your notes below, then tap send!' },
  { label: '📝 Quick quiz', mode: 'mcq', hint: 'Paste material — I\'ll make 5 MCQs' },
  { label: '🃏 Flashcards', mode: 'flashcard', hint: 'Paste content — get 8 flashcards' },
];

const FOLLOW_UPS = [
  { label: '✨ Explain simpler', text: 'Can you explain that more simply? I\'m still a bit confused.' },
  { label: '💡 Give example', text: 'Can you give me another example to help me understand better?' },
  { label: '📝 Quiz me', text: 'Quiz me on what we just covered!', switchMode: 'mcq' },
  { label: '🃏 Flashcards', text: 'Turn what we discussed into flashcards for revision.', switchMode: 'flashcard' },
];

let msgId = 0;
const newMsg = (role, text, extra = {}) => ({
  id: String(++msgId),
  role,
  text,
  time: new Date(),
  ...extra,
});

const WELCOME = "Hey! I'm **Six** ✨\n\nYour study tutor — paste notes, upload a file, or ask me anything. I'll explain things properly so you actually understand.\n\n**Tip:** After I explain, ask follow-up questions — I remember our conversation! 🚀";

/** Build API history from prior chat messages (excludes current message, welcome, typing). */
const buildHistoryFrom = (msgs) => {
  return msgs
    .filter(m => (m.role === 'user' || m.role === 'ai') && !m.isWelcome)
    .slice(-12)
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.text || '').slice(0, 4000),
    }));
};

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const TypingIndicator = ({ colors }) => {
  const dots = [useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.4)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.4, duration: 280, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={typingStyles.row}>
      <Text style={[typingStyles.label, { color: colors.purple }]}>Six is thinking</Text>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[typingStyles.dot, { backgroundColor: colors.primary, opacity: dot }]} />
      ))}
    </View>
  );
};

const typingStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  label: { fontSize: 12, fontWeight: '700', marginRight: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});

function MessageBubble({ item, colors, isDark, styles, isLastAi, onFollowUp }) {
  if (item.role === 'typing') {
    return (
      <View style={[styles.bubbleRow, styles.aiBubbleRow]}>
        <View style={[styles.sixAvatar, { backgroundColor: colors.purple }]}>
          <Text style={styles.sixAvatarEmoji}>✨</Text>
        </View>
        <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TypingIndicator colors={colors} />
        </View>
      </View>
    );
  }

  const isUser = item.role === 'user';

  return (
    <View style={[styles.bubbleRow, isUser ? styles.userBubbleRow : styles.aiBubbleRow]}>
      {!isUser && (
        <View style={[styles.sixAvatar, { backgroundColor: colors.purple }]}>
          <Text style={styles.sixAvatarEmoji}>✨</Text>
        </View>
      )}
      <View style={{ maxWidth: '80%' }}>
        {item.modeLabel && (
          <View style={[styles.modeTagPill, { backgroundColor: (isUser ? colors.primary : colors.purple) + '18' }]}>
            <Text style={[styles.modeTag, { color: isUser ? colors.primary : colors.purple }]}>
              {MODES.find(m => m.key === item.mode)?.emoji || ''} {item.modeLabel}
            </Text>
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
        ]}>
          <AIResponseRenderer text={item.text} colors={colors} isUser={isUser} />
          <Text style={[styles.bubbleTime, { color: isUser ? 'rgba(255,255,255,0.65)' : colors.textMuted }]}>
            {formatTime(item.time)}
          </Text>
        </View>
        {!isUser && isLastAi && item.id !== '1' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.followRow}>
            {FOLLOW_UPS.map(f => (
              <TouchableOpacity
                key={f.label}
                style={[styles.followChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                onPress={() => onFollowUp(f)}
              >
                <Text style={[styles.followChipText, { color: colors.textSecondary }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
      {isUser && (
        <View style={[styles.userAvatar, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <Text style={[styles.userAvatarText, { color: colors.primary }]}>You</Text>
        </View>
      )}
    </View>
  );
}

export default function AIStudyScreen() {
  const { colors, spacing, radius, isDark } = useTheme();
  const [messages, setMessages] = useState([newMsg('ai', WELCOME, { isWelcome: true })]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('explain');
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);

  const flatRef = useRef(null);
  const sendScale = useRef(new Animated.Value(1)).current;
  const styles = makeStyles(colors, spacing, radius, isDark);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const pulseSend = () => {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const extractFile = async (type, uri, mime, name, b64Direct) => {
    const user = await authStore.getUser();
    if (!user?.id) return;
    setExtracting(true);
    setShowAttachMenu(false);
    try {
      const b64 = b64Direct ?? await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const res = await axios.post(`${BASE_URL}/ai/extract.php`, {
        type, data: b64, student_id: user.id, mime,
      });
      setInput(res.data.text?.slice(0, 15000) || '');
      setAttachedFile({ name, type });
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Network error';
      Alert.alert('Upload Failed', msg);
    } finally {
      setExtracting(false);
    }
  };

  const sendToApi = async (userText, activeMode, typingId, isImage = false, imagePayload = null, history = []) => {
    const user = await authStore.getUser();
    if (!user?.id) return;
    setLoading(true);
    try {
      const payload = isImage
        ? { ...imagePayload, mode: activeMode, student_id: user.id, history }
        : { text: userText.slice(0, 15000), mode: activeMode, student_id: user.id, history };

      const response = await axios.post(`${BASE_URL}/ai/study.php`, payload);
      setRemaining(response.data.remaining);
      setSubscribed(response.data.subscribed);
      const modeLabel = MODES.find(m => m.key === activeMode)?.label || activeMode;
      setMessages(prev => [
        ...prev.filter(m => m.id !== typingId),
        newMsg('ai', response.data.result, { mode: activeMode, modeLabel }),
      ]);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || 'Something went wrong. Try again.';
      setMessages(prev => prev.filter(m => m.id !== typingId));
      if (status === 429) {
        setMessages(prev => [...prev, newMsg('ai', "You've hit the study limit for now. Try again in a little while.")]);
      } else {
        setMessages(prev => [...prev, newMsg('ai', `Hmm, something went wrong 😅\n\n${msg}`)]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendImage = async (b64, mime, fileName) => {
    setShowAttachMenu(false);
    const modeLabel = MODES.find(m => m.key === mode)?.label || mode;
    const userMsg = newMsg('user', `📷 ${fileName}`, { mode, modeLabel });
    const typingId = String(++msgId);
    const history = buildHistoryFrom(messages);
    setMessages(prev => [...prev, userMsg, { id: typingId, role: 'typing', text: '...', time: new Date() }]);
    pulseSend();
    await sendToApi('', mode, typingId, true, { image: b64, mime }, history);
  };

  const handleSend = async (overrideText, overrideMode) => {
    const userText = (overrideText ?? input).trim();
    const activeMode = overrideMode ?? mode;
    if (!userText || loading) return;

    if (!overrideText) setInput('');

    const modeLabel = MODES.find(m => m.key === activeMode)?.label || activeMode;
    const userMsg = newMsg('user', userText, { mode: activeMode, modeLabel });
    const typingId = String(++msgId);
    const history = buildHistoryFrom(messages);

    setMessages(prev => [...prev, userMsg, { id: typingId, role: 'typing', text: '...', time: new Date() }]);
    pulseSend();
    await sendToApi(userText, activeMode, typingId, false, null, history);
  };

  const handleFollowUp = (follow) => {
    if (follow.switchMode) setMode(follow.switchMode);
    handleSend(follow.text, follow.switchMode || mode);
  };

  const pickPDF = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'], copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.length > 0) {
        const file = res.assets[0];
        await extractFile('pdf', file.uri, 'application/pdf', file.name || 'document.pdf');
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not open PDF.');
    }
  };

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Please allow gallery access.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true, quality: 0.6,
      });
      if (!res.canceled && res.assets?.length > 0) {
        const asset = res.assets[0];
        if (!asset.base64) { Alert.alert('Error', 'Could not read image.'); return; }
        if (asset.base64.length > 3 * 1024 * 1024) {
          Alert.alert('Too Large', 'Please pick a photo under 2MB.');
          return;
        }
        await handleSendImage(asset.base64, asset.mimeType || 'image/jpeg', asset.fileName || 'photo.jpg');
      }
    } catch (e) { Alert.alert('Error', e?.message || 'Could not open gallery.'); }
  };

  const pickTxt = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/plain'], copyToCacheDirectory: true });
      if (!res.canceled && res.assets?.length > 0) {
        const file = res.assets[0];
        const text = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
        setInput(text.slice(0, 5000));
        setAttachedFile({ name: file.name || 'file.txt', type: 'txt' });
        setShowAttachMenu(false);
      }
    } catch { /* silent */ }
  };

  const lastAiId = [...messages].reverse().find(m => m.role === 'ai')?.id;

  const renderMessage = ({ item }) => (
    <MessageBubble
      item={item}
      colors={colors}
      isDark={isDark}
      styles={styles}
      isLastAi={item.id === lastAiId}
      onFollowUp={handleFollowUp}
    />
  );

  const remainingLabel = subscribed
    ? '✨ Unlimited'
    : remaining !== null
      ? `🔥 ${remaining} left`
      : 'Free tier';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.purple }]}>
        <View style={styles.headerGlow}>
          <View style={[styles.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={{ fontSize: 22 }}>✨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Six</Text>
            <Text style={styles.headerSub}>AI Study Buddy · {remainingLabel}</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={
            messages.length === 1 && messages[0].isWelcome ? (
              <View style={styles.quickStart}>
                <Text style={[styles.quickStartTitle, { color: colors.textMuted }]}>Quick start</Text>
                <View style={styles.quickStartRow}>
                  {QUICK_START.map(q => (
                    <TouchableOpacity
                      key={q.label}
                      style={[styles.quickChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => { setMode(q.mode); setInput(q.hint); }}
                    >
                      <Text style={[styles.quickChipText, { color: colors.text }]}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          }
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.modeBar}>
          {MODES.map(m => {
            const active = mode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeChip, {
                  backgroundColor: active ? colors.purple : colors.surface,
                  borderColor: active ? colors.purple : colors.border,
                }]}
                onPress={() => setMode(m.key)}
              >
                <Text style={styles.modeEmoji}>{m.emoji}</Text>
                <Text style={[styles.modeChipText, { color: active ? '#fff' : colors.textSecondary }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {attachedFile && (
          <View style={[styles.attachChipRow, { borderTopColor: colors.border }]}>
            <View style={[styles.attachChip, { backgroundColor: colors.purple + '15', borderColor: colors.purple }]}>
              <AppIcon name="document-outline" size={14} color={colors.purple} />
              <Text style={[styles.attachChipText, { color: colors.purple }]} numberOfLines={1}>{attachedFile.name}</Text>
              <TouchableOpacity onPress={() => { setAttachedFile(null); setInput(''); }}>
                <AppIcon name="close-circle" size={16} color={colors.purple} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttachMenu(true)} disabled={extracting}>
            {extracting
              ? <ActivityIndicator size={22} color={colors.purple} />
              : <AppIcon name="add-circle-outline" size={28} color={colors.purple} />}
          </TouchableOpacity>
          <View style={[styles.inputWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={extracting ? 'Reading file…' : 'Ask a follow-up or paste notes…'}
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={15000}
              editable={!extracting}
            />
            <Animated.View style={{ transform: [{ scale: sendScale }] }}>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: input.trim() && !loading ? colors.purple : colors.surfaceAlt }]}
                onPress={() => handleSend()}
                disabled={!input.trim() || loading || extracting}
              >
                {loading
                  ? <ActivityIndicator color={input.trim() ? '#fff' : colors.purple} size={16} />
                  : <AppIcon name="arrow-up" size={18} color={input.trim() ? '#fff' : colors.purple} />}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showAttachMenu} transparent animationType="slide" onRequestClose={() => setShowAttachMenu(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttachMenu(false)}>
          <View style={[styles.attachMenuCard, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <View style={styles.attachHandle} />
            <Text style={[styles.attachMenuTitle, { color: colors.text }]}>Upload to Six ✨</Text>
            <Text style={[styles.attachMenuSub, { color: colors.textMuted }]}>I'll read it and help you study</Text>
            <View style={styles.attachMenuRow}>
              <TouchableOpacity style={[styles.attachOption, { backgroundColor: colors.primary + '12', borderColor: colors.primary }]} onPress={pickPDF}>
                <Text style={{ fontSize: 28 }}>📄</Text>
                <Text style={[styles.attachOptionLabel, { color: colors.primary }]}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.attachOption, { backgroundColor: colors.success + '12', borderColor: colors.success }]} onPress={pickImage}>
                <Text style={{ fontSize: 28 }}>📷</Text>
                <Text style={[styles.attachOptionLabel, { color: colors.success }]}>Photo</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.attachTxtBtn, { borderColor: colors.border }]} onPress={pickTxt}>
              <AppIcon name="code-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.attachTxtLabel, { color: colors.textSecondary }]}>.txt file</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const makeStyles = (colors, spacing) => StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingBottom: 14 },
  headerGlow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingTop: 10, gap: 12,
  },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2, fontWeight: '600' },
  upgradeChip: { backgroundColor: '#FFD54F', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  upgradeChipText: { color: '#1a1a1a', fontSize: 12, fontWeight: '800' },
  messagesList: { padding: spacing.md, paddingBottom: 20, gap: 14 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  userBubbleRow: { justifyContent: 'flex-end' },
  aiBubbleRow: { justifyContent: 'flex-start' },
  sixAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sixAvatarEmoji: { fontSize: 16 },
  userAvatar: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  userAvatarText: { fontSize: 9, fontWeight: '800' },
  modeTagPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4, marginLeft: 2 },
  modeTag: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  bubble: { borderRadius: 20, padding: 14, maxWidth: '100%' },
  userBubble: { borderBottomRightRadius: 6 },
  aiBubble: { borderBottomLeftRadius: 6, borderWidth: 1 },
  bubbleTime: { fontSize: 10, marginTop: 8, textAlign: 'right', fontWeight: '500' },
  followRow: { marginTop: 8, flexGrow: 0 },
  followChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  followChipText: { fontSize: 12, fontWeight: '700' },
  quickStart: { marginTop: 8, gap: 10 },
  quickStartTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  quickStartRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  quickChipText: { fontSize: 13, fontWeight: '700' },
  modeBar: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: 8, gap: 8 },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
  },
  modeEmoji: { fontSize: 14 },
  modeChipText: { fontSize: 13, fontWeight: '700' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: 10, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  attachBtn: { paddingBottom: 8 },
  attachChipRow: { paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  attachChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, maxWidth: '85%',
  },
  attachChipText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    borderRadius: 22, paddingRight: 4, paddingLeft: 14, borderWidth: 1,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15, maxHeight: 110, paddingRight: 8 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  attachOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  attachMenuCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  attachHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 16 },
  attachMenuTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  attachMenuSub: { fontSize: 13, marginBottom: 20 },
  attachMenuRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  attachOption: { flex: 1, borderRadius: 18, borderWidth: 1.5, padding: 16, alignItems: 'center', gap: 6 },
  attachOptionLabel: { fontSize: 15, fontWeight: '800' },
  attachTxtBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  attachTxtLabel: { fontSize: 14, fontWeight: '600' },
  subBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  subBadgeText: { fontSize: 10, fontWeight: '800', color: '#000' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.xl, paddingBottom: 48 },
  modalTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  modalSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  planCard: { borderWidth: 1.5, borderRadius: 20, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.lg, gap: 6 },
  planPrice: { fontSize: 40, fontWeight: '900' },
  planPer: { fontSize: 14, fontWeight: '600', marginTop: -4 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  planFeature: { fontSize: 14, fontWeight: '600', flex: 1 },
  payBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  payBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
