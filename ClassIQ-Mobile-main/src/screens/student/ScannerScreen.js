import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Application from 'expo-application';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import { markAttendance } from '../../api/attendance';
import { AppIcon } from '../../components/AppIcon';

export default function ScannerScreen({ navigation }) {
  const { colors, spacing, radius } = useTheme();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [user, setUser] = useState(null);
  const isScanningRef = useRef(false);

  const styles = makeStyles(colors, spacing, radius);

  useEffect(() => {
    (async () => {
      const u = await authStore.getUser();
      setUser(u);
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

  if (!cameraPermission) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!cameraPermission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <AppIcon name="camera-outline" size={56} color={colors.primary} style={{ marginBottom: spacing.md }} />
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permText}>We need camera access to scan the QR code.</Text>
          <TouchableOpacity style={styles.btn} onPress={requestCameraPermission}>
            <Text style={styles.btnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (locationPermission === false) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <AppIcon name="location-outline" size={56} color={colors.warning} style={{ marginBottom: spacing.md }} />
          <Text style={styles.permTitle}>Location Access Needed</Text>
          <Text style={styles.permText}>Your location is required to verify you are physically in class.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleBarCodeScanned = async ({ data }) => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setScanned(true);
    setProcessing(true);

    try {
      // Parse QR URL
      // Expected: https://class-iq.netlify.app/mark-attendance?classrep_id=X&code=Y&lecture=Z
      const url = new URL(data);
      const classrep_id = url.searchParams.get('classrep_id');
      const code = url.searchParams.get('code');
      const lecture_name = url.searchParams.get('lecture') || 'Lecture';

      if (!classrep_id || !code) {
        Alert.alert('Invalid QR', 'This QR code is not a valid ClassIQ attendance code.', [
          { text: 'Scan Again', onPress: () => { 
            isScanningRef.current = false;
            setScanned(false); 
            setProcessing(false); 
          } }
        ]);
        return;
      }

      // Get GPS location
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      // Get device ID
      const device_id = Application.androidId || Application.ios?.identifierForVendor || 'unknown';

      // Get student index number
      const currentUser = user || await authStore.getUser();
      if (!currentUser?.index_number) {
        Alert.alert('Error', 'Could not get your student details. Please log in again.', [
          { text: 'OK', onPress: () => { isScanningRef.current = false; setScanned(false); setProcessing(false); } }
        ]);
        return;
      }

      // Mark attendance
      const result = await markAttendance({
        classrep_id: parseInt(classrep_id),
        code: parseInt(code),
        lecture_name,
        index_number: currentUser.index_number,
        device_id,
        student_lat: latitude,
        student_lng: longitude,
      });

      const isFlag = result.status === 'Flagged';
      Alert.alert(
        isFlag ? 'Flagged' : 'Attendance marked',
        result.message || 'Your attendance has been recorded.',
        [{ 
          text: 'Done', 
          onPress: () => { 
            isScanningRef.current = false;
            setScanned(false); 
            setProcessing(false); 
            navigation.navigate('Attendance', { successMessage: result.message || 'Your attendance has been recorded.' });
          } 
        }]
      );

    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to mark attendance.';
      Alert.alert('Error', msg, [
        { text: 'Try Again', onPress: () => { 
          isScanningRef.current = false;
          setScanned(false); 
          setProcessing(false); 
        } }
      ]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Scan QR Code</Text>
      <Text style={styles.subtitle}>Point your camera at the class QR code</Text>

      {/* Student info strip */}
      {user && (
        <View style={styles.studentStrip}>
          <View style={styles.studentStripInner}>
            <AppIcon name="school-outline" size={16} color={colors.primary} />
            <Text style={styles.studentStripText}>
              {user.name} · {user.index_number}
            </Text>
          </View>
        </View>
      )}

      {/* Camera */}
      <View style={styles.cameraBox}>
        {!scanned && (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          />
        )}

        {/* Corner overlays */}
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />

        {/* Processing overlay */}
        {processing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator color="#fff" size={40} />
            <Text style={styles.processingText}>Marking attendance...</Text>
          </View>
        )}
      </View>

      {/* Scan again button */}
      {scanned && !processing && (
        <TouchableOpacity style={styles.btn} onPress={() => { 
          isScanningRef.current = false;
          setScanned(false); 
          setProcessing(false); 
        }}>
          <Text style={styles.btnText}>Scan Again</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.hint}>
        Make sure you are physically inside the classroom. Your location will be verified.
      </Text>
    </SafeAreaView>
  );
}

const CORNER = 28;
const BORDER = 3;

const makeStyles = (colors, spacing, radius) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: spacing.lg },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: spacing.md },
  studentStrip: {
    backgroundColor: colors.primary + '18',
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  studentStripText: { color: colors.primary, fontWeight: '600', fontSize: 13, textAlign: 'center', flex: 1 },
  studentStripInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cameraBox: {
    width: '100%', aspectRatio: 1,
    borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: '#000', position: 'relative',
    marginBottom: spacing.lg,
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.primary },
  tl: { top: 16, left: 16, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderTopLeftRadius: 4 },
  tr: { top: 16, right: 16, borderTopWidth: BORDER, borderRightWidth: BORDER, borderTopRightRadius: 4 },
  bl: { bottom: 16, left: 16, borderBottomWidth: BORDER, borderLeftWidth: BORDER, borderBottomLeftRadius: 4 },
  br: { bottom: 16, right: 16, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderBottomRightRadius: 4 },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  processingText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginBottom: spacing.md,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  permTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  permText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 22 },
});