import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
  Image, ScrollView, Animated, Dimensions, Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import { loginStudent } from '../../api/auth';
import { AppIcon } from '../../components/AppIcon';

// Create axios instance with timeout for login
const axios = require('axios');
const { BASE_URL } = require('../../api/auth');
const loginApi = axios.create({ timeout: 20000 });

// Override loginStudent to use our instance with timeout
const loginWithTimeout = async (indexNumber, password) => {
  const response = await loginApi.post(`${BASE_URL}/auth/login.php`, {
    index_number: indexNumber,
    password,
  });
  
  // Validate response
  const data = response.data;
  if (data == null) throw new Error('Server returned an empty response.');
  if (typeof data === 'string') {
    if (/bootstrap\.php|Fatal error|require_once/i.test(data)) {
      throw new Error('Server maintenance in progress. Please try again later.');
    }
    throw new Error('Server returned HTML instead of JSON.');
  }
  if (typeof data !== 'object' || !data.user || !data.token) {
    throw new Error('Server response is missing user or token.');
  }
  return data;
};

// Storage keys for remember me
const STORAGE_KEYS = {
  REMEMBER_ME: '@classiq_remember_me',
  SAVED_INDEX: '@classiq_saved_index',
  SAVED_PASSWORD: '@classiq_saved_password',
};

export default function LoginScreen({ navigation }) {
  const { colors, spacing, radius, isDark, toggleTheme } = useTheme();
  const s = makeStyles(colors, spacing, radius);

  const [indexNumber, setIndexNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' }); // 'success' or 'error'
  const [rememberMe, setRememberMe] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    // Load saved credentials if remember me was enabled
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const isRememberMe = await AsyncStorage.getItem(STORAGE_KEYS.REMEMBER_ME);
      if (isRememberMe === 'true') {
        const savedIndex = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_INDEX);
        const savedPassword = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PASSWORD);
        if (savedIndex && savedPassword) {
          setIndexNumber(savedIndex);
          setPassword(savedPassword);
          setRememberMe(true);
        }
      }
    } catch (error) {
      console.log('Error loading saved credentials:', error.message);
    }
  };

  const saveCredentials = async () => {
    try {
      if (rememberMe) {
        await AsyncStorage.multiSet([
          [STORAGE_KEYS.REMEMBER_ME, 'true'],
          [STORAGE_KEYS.SAVED_INDEX, indexNumber.trim().toUpperCase()],
          [STORAGE_KEYS.SAVED_PASSWORD, password.trim()],
        ]);
      } else {
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.REMEMBER_ME,
          STORAGE_KEYS.SAVED_INDEX,
          STORAGE_KEYS.SAVED_PASSWORD,
        ]);
      }
    } catch (error) {
      console.log('Error saving credentials:', error.message);
    }
  };

  const handleLogin = async () => {
    // Clear any previous messages
    setMessage({ type: '', text: '' });

    // Validate inputs
    if (!indexNumber.trim()) {
      setMessage({ type: 'error', text: 'Please enter your index number.' });
      return;
    }
    if (!password.trim()) {
      setMessage({ type: 'error', text: 'Please enter your password.' });
      return;
    }

    setLoading(true);
    try {
      const result = await loginWithTimeout(indexNumber.trim().toUpperCase(), password.trim());
      await authStore.saveUser(result.user, result.token);
      
      // Save credentials if remember me is enabled
      await saveCredentials();
      
      // Show success message before navigating
      setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
      setTimeout(() => {
        navigation.replace('StudentHome', { user: result.user });
      }, 1000);
    } catch (err) {
      let errorMsg = 'Login failed. Please check your details.';
      
      // Handle different error types
      if (err.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out. Please check your internet connection.';
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        errorMsg = 'Network error. Please check your internet connection.';
      } else if (err.response) {
        const status = err.response.status;
        const data = err.response.data;
        
        if (status === 401) {
          errorMsg = data.message || 'Invalid index number or password.';
        } else if (status === 403) {
          errorMsg = data.message || 'Account not found. Please sign up first.';
        } else if (status === 400) {
          errorMsg = data.message || 'Invalid data. Please check your information.';
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

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={true}>
        <Animated.View style={[s.content, { opacity: fadeAnim }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.navigate('Landing')}>
            <AppIcon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={s.header}>
            <Image source={require('../../../assets/user-verification.png')} style={s.logo} resizeMode="contain" />
            <Text style={[s.title, { color: colors.text }]}>ClassIQ</Text>
            <Text style={[s.subtitle, { color: colors.textSecondary }]}>Your study companion.</Text>
          </View>

          <Text style={s.notice}>
            Login with your index number as your password if you already mark attendance with ClassIQ in class, and change it later in settings.
          </Text>

          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[s.cardAccent, { backgroundColor: colors.primary }]} />
            <Text style={[s.cardTitle, { color: colors.text }]}>Welcome back 👋</Text>

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
            
            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.textMuted }]}>Index Number</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                placeholder="e.g. 22BT001234"
                placeholderTextColor={colors.textMuted}
                value={indexNumber}
                onChangeText={setIndexNumber}
                autoCapitalize="characters"
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.textMuted }]}>Password</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
            </View>

            <TouchableOpacity style={[s.loginBtn, { backgroundColor: colors.primary }]} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginBtnText}>Sign In</Text>}
            </TouchableOpacity>

            {/* Remember Me & Forgot Password Row */}
            <View style={s.optionsRow}>
              <TouchableOpacity 
                style={s.rememberMeContainer} 
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[
                  s.checkbox, 
                  { 
                    borderColor: rememberMe ? colors.primary : colors.textMuted,
                    backgroundColor: rememberMe ? colors.primary : 'transparent',
                  }
                ]}>
                  {rememberMe && <AppIcon name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={[s.rememberMeText, { color: colors.textSecondary }]}>Remember me</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={[s.forgotPasswordText, { color: colors.primary }]}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.signupLink} onPress={() => navigation.navigate('Signup')}>
              <Text style={[s.signupText, { color: colors.textSecondary }]}>
                New here? <Text style={[s.signupTextBold, { color: colors.primary }]}>Create an account</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  notice: { padding: spacing.lg, fontSize: 11, color: colors.warning, textAlign: 'center', marginBottom: 10 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardAccent: { height: 4 },
  cardTitle: { fontSize: 20, fontWeight: '800', padding: spacing.lg, paddingBottom: 0 },
  inputGroup: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  input: { borderRadius: radius.md, padding: 12, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  loginBtn: { margin: spacing.lg, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  loginBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberMeText: { fontSize: 13 },
  forgotPasswordText: { fontSize: 13, fontWeight: '600' },
  signupLink: { alignItems: 'center', marginBottom: spacing.lg },
  signupText: { fontSize: 13 },
  signupTextBold: { fontWeight: '700' },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
