import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, ScrollView,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppIcon } from '../../components/AppIcon';
import { authStore } from '../../store/authStore';
import { initiateSubscription, checkPaymentStatus } from '../../api/subscription';
import { spacing, radius, getTypography } from '../../theme';

const NETWORKS = [
  { id: 'mtn', label: 'MTN', color: '#FFC107', icon: '📱' },
  { id: 'vodafone', label: 'Vodafone', color: '#E53935', icon: '📱' },
  { id: 'airteltigo', label: 'AirtelTigo', color: '#1565C0', icon: '📱' },
];

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLLS = 24; // 2 minutes max

export default function SubscriptionScreen({ navigation }) {
  const { colors } = useTheme();
  const typography = getTypography(colors);
  const s = makeStyles(colors);

  const [student, setStudent] = useState(null);
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState('mtn');
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [status, setStatus] = useState(null); // 'pending' | 'completed' | 'failed'

  const pollRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const u = await authStore.getUser();
      setStudent(u);
      if (u?.phone) setPhone(u.phone);

      try {
      const test = await axios.get('https://payments.payloqa.com/api/v1/payments/TEST123', {
        headers: {
          'X-API-Key': PAYLOQA_KEY,
          'X-Platform-Id': PAYLOQA_PLATFORM,
        },
      });
      console.log('Payloqa reachable:', test.data);
    } catch (e) {
      console.log('Payloqa test error:', e?.message, e?.response?.status, JSON.stringify(e?.response?.data));
    }
    })();

    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = (pid, sid) => {
    setPolling(true);
    setPollCount(0);
    setStatus('pending');

    pollRef.current = setInterval(async () => {
      setPollCount(prev => {
        if (prev >= MAX_POLLS) {
          clearInterval(pollRef.current);
          setPolling(false);
          setStatus('failed');
          Alert.alert(
            'Payment Timeout',
            'We could not confirm your payment. If you approved the MoMo prompt, please contact support.',
          );
          return prev;
        }
        return prev + 1;
      });

      try {
        const res = await checkPaymentStatus(pid, sid);
        if (res.status === 'completed') {
          clearInterval(pollRef.current);
          setPolling(false);
          setStatus('completed');
        } else if (res.status === 'failed' || res.status === 'cancelled') {
          clearInterval(pollRef.current);
          setPolling(false);
          setStatus('failed');
          Alert.alert('Payment Failed', 'Your payment was not successful. Please try again.');
        }
      } catch (e) {
        // keep polling on network error
      }
    }, POLL_INTERVAL);
  };

  const handleSubscribe = useCallback(async () => {
  if (!phone.trim()) return Alert.alert('Missing', 'Please enter your MoMo phone number.');
  setLoading(true);
  try {
    const res = await initiateSubscription(student.id, phone.trim(), network);
    setPaymentId(res.payment_id);
    startPolling(res.payment_id, student.id);
  } catch (e) {
    const detail = e?.response?.data ?? e?.message ?? String(e);
    Alert.alert('Payment Error', JSON.stringify(detail));
  } finally {
    setLoading(false);
  }
}, [phone, network, student]);

  // ── Success screen ────────────────────────────────────────────────────
  if (status === 'completed') {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <View style={s.resultWrap}>
          <Text style={{ fontSize: 72, marginBottom: 16 }}>🎉</Text>
          <Text style={[typography.h1, { textAlign: 'center', marginBottom: 8 }]}>
            You're all set!
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: 32 }]}>
            Six unlimited is now active. Enjoy unlimited AI study assistance for 30 days!
          </Text>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.primaryBtnText}>Start Studying 🚀</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Polling screen ────────────────────────────────────────────────────
  if (polling) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <View style={s.resultWrap}>
          <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: 24 }} />
          <Text style={[typography.h2, { textAlign: 'center', marginBottom: 8 }]}>
            Waiting for payment...
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: 8 }]}>
            Approve the MoMo prompt on your phone
          </Text>
          <Text style={[{ color: colors.textMuted, fontSize: 13, textAlign: 'center' }]}>
            Checking status... ({pollCount}/{MAX_POLLS})
          </Text>

          <TouchableOpacity
            style={[s.outlineBtn, { borderColor: colors.border, marginTop: 32 }]}
            onPress={() => {
              clearInterval(pollRef.current);
              setPolling(false);
              setStatus(null);
              setPaymentId(null);
            }}
          >
            <Text style={[s.outlineBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main subscription form ────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[s.safe, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <AppIcon name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>

          {/* Hero */}
          <Animated.View style={[s.hero, { opacity: fadeAnim }]}>
            <View style={[s.heroIcon, { backgroundColor: colors.purple + '20' }]}>
              <Text style={{ fontSize: 48 }}>✨</Text>
            </View>
            <Text style={[typography.h1, { textAlign: 'center', marginBottom: 8 }]}>
              Unlock Six Unlimited
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              Get unlimited AI explanations, flashcards, MCQs, and more
            </Text>
          </Animated.View>

          {/* Plan card */}
          <View style={[s.planCard, { backgroundColor: colors.primary }]}>
            <View style={[s.planBlob, { backgroundColor: '#ffffff15' }]} />
            <Text style={s.planLabel}>Monthly Plan</Text>
            <View style={s.planPriceRow}>
              <Text style={s.planCurrency}>GHS</Text>
              <Text style={s.planPrice}>30</Text>
              <Text style={s.planPer}>/month</Text>
            </View>
            <View style={s.planFeatures}>
              {[
                'Unlimited AI explanations',
                'Unlimited MCQ generation',
                'Unlimited flashcards',
                'Fill-in-the-blank questions',
                'Priority Six responses',
              ].map((f, i) => (
                <View key={i} style={s.planFeatureRow}>
                  <AppIcon name="checkmark-circle" size={16} color="#ffffff" />
                  <Text style={s.planFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Form */}
          <View style={[s.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.formTitle, { color: colors.text }]}>Pay with Mobile Money</Text>

            {/* Network selector */}
            <Text style={[s.label, { color: colors.textMuted }]}>Select Network</Text>
            <View style={s.networkRow}>
              {NETWORKS.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[
                    s.networkBtn,
                    { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                    network === n.id && { borderColor: n.color, backgroundColor: n.color + '18' },
                  ]}
                  onPress={() => setNetwork(n.id)}
                >
                  <Text style={{ fontSize: 20 }}>{n.icon}</Text>
                  <Text style={[s.networkLabel, {
                    color: network === n.id ? n.color : colors.textSecondary,
                    fontWeight: network === n.id ? '700' : '500',
                  }]}>
                    {n.label}
                  </Text>
                  {network === n.id && (
                    <AppIcon name="checkmark-circle" size={14} color={n.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Phone number */}
            <Text style={[s.label, { color: colors.textMuted }]}>MoMo Phone Number</Text>
            <View style={[s.inputWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <AppIcon name="call-outline" size={16} color={colors.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={[s.input, { color: colors.text }]}
                placeholder="e.g. 0244000000"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoCorrect={false}
              />
            </View>

            <Text style={[s.hint, { color: colors.textMuted }]}>
              💡 You'll receive a MoMo prompt on this number. Approve it to activate your subscription.
            </Text>

            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <AppIcon name="lock-open-outline" size={18} color="#fff" />
                    <Text style={s.primaryBtnText}>Pay GHS 30 & Activate</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

          <Text style={[s.footer, { color: colors.textMuted }]}>
            Secured by Payloqa · Cancel anytime
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg },
  backBtn: { alignSelf: 'flex-start', padding: 4, marginBottom: spacing.md },
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  heroIcon: { width: 100, height: 100, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  planCard: {
    borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.lg, overflow: 'hidden', position: 'relative',
  },
  planBlob: { position: 'absolute', width: 150, height: 150, borderRadius: 75, top: -40, right: -20 },
  planLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  planPriceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: spacing.md },
  planCurrency: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  planPrice: { color: '#fff', fontSize: 52, fontWeight: '900', lineHeight: 56 },
  planPer: { color: 'rgba(255,255,255,0.7)', fontSize: 16, marginBottom: 8 },
  planFeatures: { gap: 8 },
  planFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planFeatureText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  formCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  formTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.lg },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  networkRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  networkBtn: { flex: 1, alignItems: 'center', padding: 12, borderRadius: radius.md, borderWidth: 1.5, gap: 4 },
  networkLabel: { fontSize: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  input: { flex: 1, fontSize: 15, paddingVertical: 14 },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: spacing.lg },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: radius.full },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  outlineBtn: { paddingVertical: 14, borderRadius: radius.full, borderWidth: 1.5, alignItems: 'center', paddingHorizontal: spacing.xl },
  outlineBtnText: { fontWeight: '600', fontSize: 15 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: spacing.sm },
});