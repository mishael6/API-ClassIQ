import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Switch, Alert, TextInput,
  ActivityIndicator, Platform,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import { AppIcon } from '../../components/AppIcon';
import axios from 'axios';
import { BASE_URL } from '../../api/auth';
import {
  isPushSupported, subscribeToPush, unsubscribeFromPush, isPushEnabled,
  getPushUnsupportedReason, registerServiceWorker, isIOS, isStandalonePWA,
} from '../../utils/pushNotifications';
import { confirmLogout } from '../../utils/logout';

export default function SettingsScreen({ navigation, route }) {
  const { colors, spacing, isDark, toggleTheme } = useTheme();
  const user = route?.params?.user;
  const isClassrep = user?.role === 'classrep' || user?.role === 'class_rep';

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [program, setProgram] = useState(user?.program || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [level, setLevel] = useState(user?.level || '');
  const [institution, setInstitution] = useState(user?.institution || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const isWeb = Platform.OS === 'web';
  const pushSupported = isWeb && isPushSupported();
  const pushBlockReason = isWeb && !pushSupported ? getPushUnsupportedReason() : null;

  useEffect(() => {
    if (isWeb) {
      registerServiceWorker().catch(() => {});
    }
  }, [isWeb]);

  useEffect(() => {
    if (pushSupported) {
      isPushEnabled().then(setPushEnabled);
    }
  }, [pushSupported]);

  useFocusEffect(
    useCallback(() => {
      if (pushSupported) {
        isPushEnabled().then(setPushEnabled);
      }
    }, [pushSupported])
  );

  const togglePush = async (value) => {
    const previous = pushEnabled;
    setPushEnabled(value);
    setPushLoading(true);
    try {
      if (value) {
        await subscribeToPush();
        setPushEnabled(true);
        if (Platform.OS === 'web') {
          window.alert('Push notifications enabled!');
        } else {
          Alert.alert('Enabled', 'You will receive push notifications from ClassIQ.');
        }
      } else {
        await unsubscribeFromPush();
        setPushEnabled(false);
      }
    } catch (e) {
      setPushEnabled(previous);
      const msg = e?.message || 'Could not update notification settings.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Notifications', msg);
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handleSave = async () => {
    if (newPassword && newPassword.length < 6) {
      return Alert.alert('Weak password', 'Password must be at least 6 characters.');
    }
    if (newPassword && newPassword !== confirmNewPassword) {
      return Alert.alert('Mismatch', 'Passwords do not match.');
    }
    setSaving(true);
    try {
      const token = await authStore.getToken();
      await axios.post(`${BASE_URL}/student/update_profile.php`, {
        name, email, phone, program, department, level, institution,
        ...(oldPassword ? { old_password: oldPassword } : {}),
        ...(newPassword ? { password: newPassword } : {}),
      }, { headers: { Authorization: `Bearer ${token}` } });

      const updatedUser = { ...user, name, email, phone, program, department, level, institution };
      const t = await authStore.getToken();
      await authStore.saveUser(updatedUser, t);

      Alert.alert('Saved!', 'Your profile has been updated.');
      setEditing(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to save. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const logout = () => confirmLogout(navigation);

  const profileFields = [
    { label: 'Full Name', value: name, setter: setName, keyboard: 'default' },
    { label: 'Email', value: email, setter: setEmail, keyboard: 'email-address' },
    { label: 'Phone', value: phone, setter: setPhone, keyboard: 'phone-pad' },
    { label: 'Institution', value: institution, setter: setInstitution, keyboard: 'default' },
    { label: 'Program', value: program, setter: setProgram, keyboard: 'default' },
    { label: 'Department', value: department, setter: setDepartment, keyboard: 'default' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.profileName}>{name || 'User'}</Text>
          </View>

          <Text style={styles.sectionLabel}>Appearance</Text>
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.text }}>Night Mode</Text>
            <Switch value={isDark} onValueChange={toggleTheme} />
          </View>

          {isWeb && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Notifications</Text>
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>Push Notifications</Text>
                      {pushEnabled && (
                        <View style={[styles.enabledBadge, { backgroundColor: colors.primary + '22' }]}>
                          <Text style={[styles.enabledBadgeText, { color: colors.primary }]}>Enabled</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                      {pushEnabled
                        ? 'You will receive alerts for attendance, messages & updates'
                        : 'Alerts for attendance, messages & updates'}
                    </Text>
                  </View>
                  {pushSupported && (
                    pushLoading ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Switch
                        value={pushEnabled}
                        onValueChange={togglePush}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor="#fff"
                      />
                    )
                  )}
                </View>

                {!pushSupported && (
                  <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
                    {pushBlockReason || 'Push is not available here.'}
                    {isIOS() && !isStandalonePWA() && (
                      <>
                        {'\n\n'}📱 <Text style={{ fontWeight: '700' }}>iPhone steps:</Text>
                        {'\n'}1. Open your Netlify URL in Safari
                        {'\n'}2. Tap Share (□↑) at the bottom
                        {'\n'}3. Tap "Add to Home Screen"
                        {'\n'}4. Open ClassIQ from the new home screen icon
                        {'\n'}5. Come back here and enable push
                      </>
                    )}
                  </Text>
                )}

                {pushSupported && !pushEnabled && (
                  <TouchableOpacity
                    style={[styles.enablePushBtn, { backgroundColor: colors.primary }]}
                    onPress={() => togglePush(true)}
                    disabled={pushLoading}
                  >
                    <Text style={styles.enablePushBtnText}>
                      {pushLoading ? 'Enabling…' : 'Enable Push Notifications'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <View style={styles.accountHeader}>
            <Text style={styles.sectionLabel}>Account</Text>
            <TouchableOpacity onPress={() => setEditing(!editing)}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{editing ? 'Cancel' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {profileFields.map((field) => (
              <View key={field.label} style={styles.fieldWrap}>
                <Text style={styles.label}>{field.label}</Text>
                {editing ? (
                  <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} value={field.value} onChangeText={field.setter} />
                ) : (
                  <Text style={{ color: colors.text }}>{field.value || '—'}</Text>
                )}
              </View>
            ))}
            {editing && (
              <>
                <Text style={styles.label}>Old Password</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} secureTextEntry value={oldPassword} onChangeText={setOldPassword} />
                <Text style={styles.label}>New Password</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]} secureTextEntry value={confirmNewPassword} onChangeText={setConfirmNewPassword} />
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity style={[styles.logoutBtn, { borderColor: colors.error }]} onPress={logout}>
            <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.reportBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('ReportIssue')}
          >
            <Text style={{ color: colors.text }}>Report an Issue</Text>
          </TouchableOpacity>

          {isWeb && (
            <TouchableOpacity
              style={[styles.reportBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { window.open('https://class-iq.netlify.app/privacy', '_blank'); }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Privacy Policy</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: 20 },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  profileCard: { padding: 20, borderRadius: 16, marginBottom: 20 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 12, borderWidth: 1 },
  accountHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  accountCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginTop: 10 },
  fieldWrap: { marginBottom: 15 },
  label: { fontSize: 10, fontWeight: '700', color: '#888', marginBottom: 5 },
  input: { borderRadius: 8, padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#ddd', marginBottom: 10 },
  saveBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  logoutBtn: { padding: 15, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginTop: 20 },
  logoutText: { fontWeight: '800' },
  reportBtn: { padding: 15, borderRadius: 12, borderWidth: 1, alignItems: 'center', marginTop: 10 },
  enablePushBtn: { padding: 12, borderRadius: 10, alignItems: 'center' },
  enablePushBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  enabledBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  enabledBadgeText: { fontSize: 11, fontWeight: '700' },
});
