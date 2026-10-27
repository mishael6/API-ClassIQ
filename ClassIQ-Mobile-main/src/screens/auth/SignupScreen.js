import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image,
  ScrollView, Animated, Modal, Dimensions, FlatList,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppIcon } from '../../components/AppIcon';
import axios from 'axios';
import { BASE_URL } from '../../api/auth';

const { height: SCREEN_H } = Dimensions.get('window');

// Validation helpers
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^(\+233|0)[1-9]\d{8}$/.test(phone.replace(/\s/g, ''));

// Create axios instance with timeout
const api = axios.create({
  timeout: 20000, // 20 second timeout
});

export default function SignupScreen({ navigation }) {
  const { colors, spacing, radius } = useTheme();
  const s = makeStyles(colors, spacing, radius);

  const [name, setName] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [institution, setInstitution] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' }); // 'success' or 'error'

  // Classrep selection
  const [classreps, setClassreps] = useState([]);
  const [selectedClassrep, setSelectedClassrep] = useState(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loadingClassreps, setLoadingClassreps] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    fetchClassreps('');
  }, []);

  const fetchClassreps = async (q) => {
    setLoadingClassreps(true);
    try {
      const res = await api.get(`${BASE_URL}/auth/get_classreps.php`, {
        params: { search: q },
      });
      setClassreps(res.data.classreps || []);
    } catch (e) {
      console.log('Failed to fetch classreps:', e.message);
      setClassreps([]);
    } finally {
      setLoadingClassreps(false);
    }
  };

  const handleSearch = (text) => {
    setSearch(text);
    fetchClassreps(text);
  };

  const validateForm = () => {
    if (!name.trim()) return { valid: false, message: 'Full name is required.' };
    if (!indexNumber.trim()) return { valid: false, message: 'Index number is required.' };
    if (!institution.trim()) return { valid: false, message: 'Institution is required.' };
    if (!email.trim()) return { valid: false, message: 'Email is required.' };
    if (!isValidEmail(email.trim())) return { valid: false, message: 'Please enter a valid email address.' };
    if (!phone.trim()) return { valid: false, message: 'Phone number is required.' };
    if (!isValidPhone(phone.trim())) return { valid: false, message: 'Please enter a valid phone number (e.g., 0244000000).' };
    if (!password.trim()) return { valid: false, message: 'Password is required.' };
    if (password.length < 6) return { valid: false, message: 'Password must be at least 6 characters.' };
    if (password !== confirmPassword) return { valid: false, message: 'Passwords do not match.' };
    return { valid: true };
  };

  const handleSignup = async () => {
    // Clear any previous messages
    setMessage({ type: '', text: '' });

    const validation = validateForm();
    if (!validation.valid) {
      setMessage({ type: 'error', text: validation.message });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post(`${BASE_URL}/auth/student_register.php`, {
        name: name.trim(),
        index_number: indexNumber.trim(),
        institution: institution.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: password.trim(),
        confirm_password: confirmPassword.trim(),
        classrep_id: selectedClassrep?.id || 'none',
        user_id: selectedClassrep?.id || 'none', // Send 'none' if no classrep selected
      });

      if (res.data.success || res.data.message) {
        setMessage({ type: 'success', text: 'Account created successfully! Redirecting to login...' });
        // Navigate after showing success message
        setTimeout(() => {
          navigation.replace('Login');
        }, 2000);
      } else {
        throw new Error(res.data.message || 'Unexpected response from server');
      }
    } catch (e) {
      let errorMsg = 'Signup failed. Please try again.';
      
      // Log the full error for debugging
      console.log('Signup error:', {
        code: e.code,
        message: e.message,
        status: e.response?.status,
        data: e.response?.data,
        isAxiosError: e.isAxiosError,
      });
      
      if (e.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out. Please check your internet connection.';
      } else if (e.code === 'NETWORK_ERROR' || !e.response) {
        errorMsg = 'Network error. Please check your internet connection.';
      } else if (e.response) {
        const status = e.response.status;
        const data = e.response.data;
        
        if (status === 400) {
          errorMsg = data.message || 'Invalid data. Please check your information.';
        } else if (status === 409) {
          errorMsg = data.message || 'An account with this email or index number already exists.';
        } else if (status === 500) {
          // Try to extract more specific error message from server response
          if (data && typeof data === 'object') {
            errorMsg = data.message || data.error || 'Server error (500). Please try again later.';
          } else if (typeof data === 'string') {
            // Check for PHP errors
            if (data.includes('SQLSTATE')) {
              errorMsg = 'Database error. Please try again later or contact support.';
            } else if (data.includes('bootstrap') || data.includes('Fatal error')) {
              errorMsg = 'Server maintenance in progress. Please try again later.';
            } else {
              errorMsg = 'Server returned an error. Please try again.';
            }
          } else {
            errorMsg = 'Server error (500). Please try again later.';
          }
        } else if (data?.message) {
          errorMsg = data.message;
        } else if (typeof data === 'string') {
          if (data.includes('bootstrap') || data.includes('Fatal error')) {
            errorMsg = 'Server maintenance in progress. Please try again later.';
          } else {
            errorMsg = data.substring(0, 100); // Show first 100 chars of error
          }
        } else {
          errorMsg = `Server error (${status}). Please try again.`;
        }
      } else if (e.message) {
        errorMsg = e.message;
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
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={[s.content, { opacity: fadeAnim }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <AppIcon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={s.header}>
            <Image source={require('../../../assets/user-verification.png')} style={s.logo} resizeMode="contain" />
            <Text style={[s.title, { color: colors.text }]}>Create Account</Text>
          </View>

          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[s.cardAccent, { backgroundColor: colors.primary }]} />
            <View style={s.cardBody}>

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
                <Text style={s.label}>Full Name *</Text>
                <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} placeholder="e.g. Kofi Mensah" value={name} onChangeText={setName} />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.label}>Index Number *</Text>
                <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} placeholder="e.g. 22BT001234" value={indexNumber} onChangeText={setIndexNumber} autoCapitalize="characters" />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.label}>Institution *</Text>
                <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} placeholder="e.g. Kumasi Tech University" value={institution} onChangeText={setInstitution} />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.label}>Email *</Text>
                <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} placeholder="your@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.label}>Phone *</Text>
                <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} placeholder="e.g. 0244000000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.label}>Password *</Text>
                <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} placeholder="Min. 6 characters" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.label}>Confirm Password *</Text>
                <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} placeholder="Re-enter password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />
              </View>

              {/* Classrep Selection */}
              <View style={s.inputGroup}>
                <Text style={s.label}>Your Class Representative</Text>
                <TouchableOpacity
                  style={[s.classrepSelect, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                  onPress={() => setShowModal(true)}
                >
                  <AppIcon name="people-outline" size={20} color={colors.textMuted} />
                  <Text style={[s.classrepSelectText, { color: selectedClassrep ? colors.text : colors.textMuted }]}>
                    {selectedClassrep ? selectedClassrep.name : 'Type "none" or search for your classrep'}
                  </Text>
                  <AppIcon name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.primary }]} onPress={handleSignup}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Create Account</Text>}
              </TouchableOpacity>

              {/* Classrep Search Modal */}
              <Modal visible={showModal} animationType="slide" transparent={true}>
                <View style={s.modalOverlay}>
                  <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
                    <View style={s.modalHeader}>
                      <Text style={[s.modalTitle, { color: colors.text }]}>Select Class Representative</Text>
                      <TouchableOpacity onPress={() => setShowModal(false)}>
                        <AppIcon name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    <View style={[s.searchBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                      <AppIcon name="search" size={20} color={colors.textMuted} />
                      <TextInput
                        style={[s.searchInput, { color: colors.text }]}
                        placeholder="Search by name or index number..."
                        placeholderTextColor={colors.textMuted}
                        value={search}
                        onChangeText={handleSearch}
                      />
                    </View>

                    {loadingClassreps ? (
                      <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
                    ) : (
                      <>
                        {/* "None" Option - Always available */}
                        <TouchableOpacity
                          style={[
                            s.classrepItem,
                            { borderBottomColor: colors.border },
                            !selectedClassrep && { backgroundColor: colors.primary + '15' }
                          ]}
                          onPress={() => {
                            setSelectedClassrep(null);
                            setShowModal(false);
                          }}
                        >
                          <View style={s.classrepInfo}>
                            <Text style={[s.classrepName, { color: colors.text, fontStyle: 'italic' }]}>none</Text>
                            <Text style={[s.classrepIndex, { color: colors.textMuted }]}>
                              No class representative
                            </Text>
                          </View>
                          {!selectedClassrep && (
                            <AppIcon name="checkmark-circle" size={24} color={colors.primary} />
                          )}
                        </TouchableOpacity>

                        {/* Classrep List */}
                        {classreps.length > 0 ? (
                          <FlatList
                            data={classreps}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => (
                              <TouchableOpacity
                                style={[
                                  s.classrepItem,
                                  { borderBottomColor: colors.border },
                                  selectedClassrep?.id === item.id && { backgroundColor: colors.primary + '15' }
                                ]}
                                onPress={() => {
                                  setSelectedClassrep(item);
                                  setShowModal(false);
                                }}
                              >
                                <View style={s.classrepInfo}>
                                  <Text style={[s.classrepName, { color: colors.text }]}>{item.name}</Text>
                                  <Text style={[s.classrepIndex, { color: colors.textMuted }]}>
                                    {item.index_number} · {item.department || 'N/A'}
                                  </Text>
                                </View>
                                {selectedClassrep?.id === item.id && (
                                  <AppIcon name="checkmark-circle" size={24} color={colors.primary} />
                                )}
                              </TouchableOpacity>
                            )}
                            scrollEnabled={false}
                          />
                        ) : search.length > 0 ? (
                          <Text style={[s.noResults, { color: colors.textMuted }]}>
                            No classreps found. Select "none" above.
                          </Text>
                        ) : null}
                      </>
                    )}
                  </View>
                </View>
              </Modal>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors, spacing, radius) => StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.md },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  backBtn: { marginBottom: spacing.md },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  logo: { width: 60, height: 60, marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '800' },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  cardAccent: { height: 4 },
  cardBody: { padding: spacing.lg },
  inputGroup: { marginBottom: spacing.sm },
  label: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4, color: colors.textMuted },
  input: { borderRadius: radius.md, padding: 12, fontSize: 14, borderWidth: 1, borderColor: colors.border },
  submitBtn: { paddingVertical: 12, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
  submitBtnText: { color: '#fff', fontWeight: '800' },
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
  classrepSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  classrepSelectText: {
    flex: 1,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  noResults: {
    textAlign: 'center',
    padding: spacing.lg,
    fontSize: 14,
  },
  classrepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  classrepInfo: {
    flex: 1,
  },
  classrepName: {
    fontSize: 15,
    fontWeight: '600',
  },
  classrepIndex: {
    fontSize: 12,
    marginTop: 2,
  },
});
