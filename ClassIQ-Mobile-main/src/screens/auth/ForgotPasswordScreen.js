import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, ScrollView, Animated, Alert, Linking,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppIcon } from '../../components/AppIcon';
import axios from 'axios';
import { BASE_URL } from '../../api/auth';

// Create axios instance with timeout
const api = axios.create({
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default function ForgotPasswordScreen({ navigation }) {
  const { colors, spacing, radius } = useTheme();
  const s = makeStyles(colors, spacing, radius);

  const [recoveryMethod, setRecoveryMethod] = useState('email'); // 'email' or 'phone'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [sent, setSent] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // Validation helpers
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone) => /^(\+233|0)[1-9]\d{8}$/.test(phone.replace(/\s/g, ''));

  const handleResetPassword = async () => {
    // Clear any previous messages
    setMessage({ type: '', text: '' });

    // Validate inputs based on recovery method
    if (recoveryMethod === 'email') {
      if (!email.trim()) {
        setMessage({ type: 'error', text: 'Please enter your email address.' });
        return;
      }
      if (!isValidEmail(email.trim())) {
        setMessage({ type: 'error', text: 'Please enter a valid email address.' });
        return;
      }
    } else {
      if (!phone.trim()) {
        setMessage({ type: 'error', text: 'Please enter your phone number.' });
        return;
      }
      if (!isValidPhone(phone.trim())) {
        setMessage({ type: 'error', text: 'Please enter a valid phone number (e.g., 0244000000).' });
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = recoveryMethod === 'email' 
        ? `${BASE_URL}/auth/forgot_password.php`
        : `${BASE_URL}/auth/forgot_password_phone.php`;

      const payload = recoveryMethod === 'email' 
        ? { email: email.trim(), action: 'reset_password' }
        : { phone: phone.trim(), action: 'reset_password' };

      const response = await api.post(endpoint, payload);

      if (response.data.success || response.data.message) {
        setMessage({ 
          type: 'success', 
          text: recoveryMethod === 'email'
            ? 'Password reset instructions have been sent to your email.'
            : 'Password reset instructions have been sent to your phone.'
        });
        setSent(true);
      } else {
        throw new Error(response.data.message || 'Failed to send reset instructions.');
      }
    } catch (err) {
      let errorMsg = 'Failed to send reset instructions. Please try again.';
      
      if (err.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out. Please check your internet connection.';
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        errorMsg = 'Network error. Please check your internet connection.';
      } else if (err.response) {
        const status = err.response.status;
        const data = err.response.data;
        
        if (status === 400) {
          errorMsg = data.message || 'Invalid data. Please check your information.';
        } else if (status === 404) {
          errorMsg = data.message || 'No account found with this ' + (recoveryMethod === 'email' ? 'email' : 'phone number') + '.';
        } else if (status === 500) {
          errorMsg = 'Server error. Please try again later.';
        } else if (data?.message) {
          errorMsg = data.message;
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleContactSupport = () => {
    // Open default email client with pre-filled message
    const subject = encodeURIComponent('Password Reset Request - ClassIQ');
    const body = encodeURIComponent('Hello,\n\nI am having trouble resetting my password for ClassIQ. Please assist me.\n\nMy details:\n- Name: \n- Index Number: \n- Email: \n- Phone: \n\nThank you.');
    Linking.openURL(`mailto:support@classiq.com?subject=${subject}&body=${body}`);
  };

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s.content, { opacity: fadeAnim }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <AppIcon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={s.header}>
            <Image source={require('../../../assets/user-verification.png')} style={s.logo} resizeMode="contain" />
            <Text style={[s.title, { color: colors.text }]}>Reset Password</Text>
            <Text style={[s.subtitle, { color: colors.textSecondary }]}>
              {!sent 
                ? 'Enter your email or phone number to receive password reset instructions.'
                : 'Check your inbox for reset instructions.'}
            </Text>
          </View>

          {!sent ? (
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.cardAccent, { backgroundColor: colors.primary }]} />
              
              {/* Message Display */}
              {message.text ? (
                <View style={[s.messageBox, { 
                  backgroundColor: message.type === 'success' ? colors.success + '15' : colors.error + '15',
                  borderColor: message.type === 'success' ? colors.success + '30' : colors.error + '30',
                }]}>
                  <AppIcon 
                    name={message.type === 'success' ? 'checkmark-circle' : 'alert-circle'} 
                    size={18} 
                    color={message.type === 'success' ? colors.success : colors.error} 
                  />
                  <Text style={[s.messageText, { color: message.type === 'success' ? colors.success : colors.error }]}>
                    {message.text}
                  </Text>
                </View>
              ) : null}

              {/* Recovery Method Tabs */}
              <View style={s.tabContainer}>
                <TouchableOpacity
                  style={[s.tab, recoveryMethod === 'email' && { backgroundColor: colors.primary }]}
                  onPress={() => setRecoveryMethod('email')}
                >
                  <AppIcon 
                    name="mail-outline" 
                    size={18} 
                    color={recoveryMethod === 'email' ? '#fff' : colors.textMuted} 
                  />
                  <Text style={[s.tabText, recoveryMethod === 'email' && { color: '#fff' }]}>
                    Email
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.tab, recoveryMethod === 'phone' && { backgroundColor: colors.primary }]}
                  onPress={() => setRecoveryMethod('phone')}
                >
                  <AppIcon 
                    name="call-outline" 
                    size={18} 
                    color={recoveryMethod === 'phone' ? '#fff' : colors.textMuted} 
                  />
                  <Text style={[s.tabText, recoveryMethod === 'phone' && { color: '#fff' }]}>
                    Phone
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Input Field */}
              <View style={s.inputGroup}>
                <Text style={[s.label, { color: colors.textMuted }]}>
                  {recoveryMethod === 'email' ? 'Email Address' : 'Phone Number'}
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                  placeholder={recoveryMethod === 'email' ? 'your@email.com' : 'e.g. 0244000000'}
                  placeholderTextColor={colors.textMuted}
                  value={recoveryMethod === 'email' ? email : phone}
                  onChangeText={recoveryMethod === 'email' ? setEmail : setPhone}
                  keyboardType={recoveryMethod === 'email' ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity 
                style={[s.submitBtn, { backgroundColor: colors.primary }]} 
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitBtnText}>Send Reset Instructions</Text>
                )}
              </TouchableOpacity>

              <View style={s.helpSection}>
                <Text style={[s.helpText, { color: colors.textSecondary }]}>
                  Still having trouble?{' '}
                  <Text style={[s.helpLink, { color: colors.primary }]} onPress={handleContactSupport}>
                    Contact Support
                  </Text>
                </Text>
              </View>
            </View>
          ) : (
            // Success state
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.cardAccent, { backgroundColor: colors.success }]} />
              
              <View style={s.successIconContainer}>
                <View style={[s.successIcon, { backgroundColor: colors.success + '15' }]}>
                  <AppIcon name="mail" size={40} color={colors.success} />
                </View>
              </View>

              <Text style={[s.successTitle, { color: colors.text }]}>
                {recoveryMethod === 'email' ? 'Check Your Email' : 'Check Your Phone'}
              </Text>
              
              <Text style={[s.successMessage, { color: colors.textSecondary }]}>
                We've sent password reset instructions to your{' '}
                <Text style={{ fontWeight: '600', color: colors.text }}>
                  {recoveryMethod === 'email' ? email : phone}
                </Text>.
                {'\n\n'}
                If you don't see it, check your spam folder or try again.
              </Text>

              <TouchableOpacity 
                style={[s.submitBtn, { backgroundColor: colors.primary }]} 
                onPress={() => navigation.goBack()}
              >
                <Text style={s.submitBtnText}>Back to Login</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={s.resendBtn} 
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={[s.resendBtnText, { color: colors.primary }]}>
                    Resend Instructions
                  </Text>
                )}
              </TouchableOpacity>

              <View style={s.helpSection}>
                <Text style={[s.helpText, { color: colors.textSecondary }]}>
                  Need help?{' '}
                  <Text style={[s.helpLink, { color: colors.primary }]} onPress={handleContactSupport}>
                    Contact Support
                  </Text>
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors, spacing, radius) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.md, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  backBtn: { marginBottom: spacing.md },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  logo: { width: 60, height: 60, marginBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardAccent: { height: 4 },
  inputGroup: { padding: spacing.lg, paddingBottom: 0 },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  input: { borderRadius: radius.md, padding: 12, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  submitBtn: { margin: spacing.lg, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    margin: spacing.lg,
    marginTop: 0,
    borderRadius: 10,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  helpSection: {
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: 0,
  },
  helpText: {
    fontSize: 13,
  },
  helpLink: {
    fontWeight: '700',
  },
  successIconContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    paddingBottom: 0,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    padding: spacing.lg,
  },
  resendBtn: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  resendBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
