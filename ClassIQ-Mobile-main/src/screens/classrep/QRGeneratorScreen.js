import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TextInput, TouchableOpacity, ActivityIndicator, Alert,
  Modal, Platform, Dimensions,
} from 'react-native';
// MapView imported conditionally for web compatibility
let MapView, Marker;
if (Platform.OS !== 'web') {
  const RNMaps = require('react-native-maps');
  MapView = RNMaps.default;
  Marker = RNMaps.Marker;
}
import { SafeAreaView as SafeArea } from 'react-native-safe-area-context';
// Conditional QRCode import for web compatibility
let QRCode;
if (Platform.OS !== 'web') {
  try {
    QRCode = require('react-native-qrcode-svg').default;
  } catch (e) {
    // QRCode not available
  }
}
import * as Location from 'expo-location';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import { generateQR, endSession, fetchSavedLectures } from '../../api/classrep';
import { AppIcon } from '../../components/AppIcon';

const { height: SCREEN_H } = Dimensions.get('window');
const MAP_HEIGHT = Math.min(SCREEN_H * 0.55, 420);

/** Default map center (Ghana) when GPS is unavailable */
const DEFAULT_COORDS = { latitude: 5.6037, longitude: -0.187 };

const toLatLng = (c) =>
  c && typeof c.latitude === 'number' && typeof c.longitude === 'number'
    ? { latitude: c.latitude, longitude: c.longitude }
    : null;

export default function QRGeneratorScreen() {
  const { colors, spacing, radius } = useTheme();

  const [lectureName, setLectureName] = useState('');
  const [savedLectures, setSavedLectures] = useState([]);
  const [radius_m, setRadius_m] = useState('100');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [ending, setEnding] = useState(false);
  /** Confirmed session point (used for Generate) */
  const [location, setLocation] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  /** Live marker position while map modal is open */
  const [mapDraft, setMapDraft] = useState(DEFAULT_COORDS);
  const [locating, setLocating] = useState(false);

  const styles = makeStyles(colors, spacing, radius);

  const loadGpsLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return toLatLng(loc.coords);
  }, []);

  useEffect(() => {
    (async () => {
      const coords = await loadGpsLocation();
      if (coords) {
        setLocation(coords);
        setMapDraft(coords);
      }
    })();
  }, [loadGpsLocation]);

  useEffect(() => {
    (async () => {
      try {
        const token = await authStore.getToken();
        const data = await fetchSavedLectures(token);
        const list = data.lectures || [];
        setSavedLectures(list);
        if (list.length) setLectureName(list[0].name);
      } catch {
        // silent
      }
    })();
  }, []);

  const openMapPicker = () => {
    const base = location || mapDraft || DEFAULT_COORDS;
    setMapDraft({ latitude: base.latitude, longitude: base.longitude });
    setMapVisible(true);
  };

  const confirmMapLocation = () => {
    setLocation({ latitude: mapDraft.latitude, longitude: mapDraft.longitude });
    setMapVisible(false);
  };

  const applyGpsToSession = async () => {
    setLocating(true);
    try {
      const coords = await loadGpsLocation();
      if (coords) {
        setLocation(coords);
        setMapDraft(coords);
      } else {
        Alert.alert('Location', 'Allow location access to use your current position.');
      }
    } finally {
      setLocating(false);
    }
  };

  const jumpMapToGps = async () => {
    setLocating(true);
    try {
      const coords = await loadGpsLocation();
      if (coords) {
        setMapDraft(coords);
      } else {
        Alert.alert('Location', 'Allow location access to jump to your position.');
      }
    } finally {
      setLocating(false);
    }
  };

  const mapRegion = {
    latitude: mapDraft.latitude,
    longitude: mapDraft.longitude,
    latitudeDelta: 0.006,
    longitudeDelta: 0.006,
  };

  const handleGenerate = async () => {
    if (!lectureName.trim()) {
      Alert.alert('Missing field', 'Please select a lecture. Add lecture names on your dashboard first.');
      return;
    }
    if (!location) {
      Alert.alert('Location needed', 'Open the map and choose where this session takes place, then confirm.');
      return;
    }

    setLoading(true);
    try {
      const token = await authStore.getToken();
      const result = await generateQR(token, {
        lecture_name: lectureName.trim(),
        lat: location.latitude,
        lng: location.longitude,
        radius_m: parseInt(radius_m, 10) || 100,
      });
      setSession(result.session);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to generate QR code.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this attendance session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            setEnding(true);
            try {
              const token = await authStore.getToken();
              await endSession(token, session.id);
              Alert.alert('Session Ended', 'Attendance session has been closed.');
              setSession(null);
              setLectureName('');
            } catch (err) {
              Alert.alert('Error', 'Failed to end session.');
            } finally {
              setEnding(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>

        <Text style={[styles.title, { color: colors.text }]}>Generate QR Code</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Students will scan this to mark their attendance
        </Text>

        {!session ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Lecture Name</Text>
            {savedLectures.length === 0 ? (
              <Text style={[styles.hintText, { color: colors.warning }]}>
                No lectures saved yet. Add lecture names on your Dashboard first.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {savedLectures.map(lec => {
                  const active = lectureName === lec.name;
                  return (
                    <TouchableOpacity
                      key={lec.id}
                      style={[styles.lectureChip, {
                        backgroundColor: active ? colors.primary : colors.surfaceAlt,
                        borderColor: active ? colors.primary : colors.border,
                      }]}
                      onPress={() => setLectureName(lec.name)}
                    >
                      <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>
                        {lec.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={[styles.label, { color: colors.textMuted }]}>Radius (meters)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              placeholder="100"
              placeholderTextColor={colors.textMuted}
              value={radius_m}
              onChangeText={setRadius_m}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: colors.textMuted }]}>Session location</Text>
            <View style={[styles.locationRow, { backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 12 }]}>
              <AppIcon
                name={location ? 'location' : 'map-outline'}
                size={20}
                color={location ? colors.success : colors.textMuted}
              />
              <Text style={[styles.locationText, { color: location ? colors.text : colors.textMuted }]}>
                {location
                  ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                  : 'No point selected yet'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.mapBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '14' }]}
              onPress={openMapPicker}
            >
              <AppIcon name="map" size={20} color={colors.primary} />
              <Text style={[styles.mapBtnText, { color: colors.primary }]}>
                {location ? 'Change location on map' : 'Choose location on map'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.border }]}
              onPress={applyGpsToSession}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <AppIcon name="navigate-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Use my current GPS</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: (loading || !savedLectures.length || !lectureName) ? 0.5 : 1 }]}
              onPress={handleGenerate}
              disabled={loading || !savedLectures.length || !lectureName}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Generate QR Code</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.qrCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.qrLectureRow}>
                <AppIcon name="book-outline" size={18} color={colors.text} />
                <Text style={[styles.qrLecture, { color: colors.text, flex: 1 }]}>{session.lecture_name}</Text>
              </View>
              <Text style={[styles.qrCode, { color: colors.primary }]}>Code: {session.code}</Text>

              <View style={styles.qrBox}>
                {Platform.OS === 'web' || !QRCode ? (
                  <View style={{ width: 220, height: 220, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
                    <AppIcon name="qr-code-outline" size={80} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 12 }}>QR Code (Mobile only)</Text>
                    <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 10, textAlign: 'center', padding: 8 }}>
                      Code: {session.code}
                    </Text>
                  </View>
                ) : (
                  <QRCode
                    value={session.attendance_url}
                    size={220}
                    color="#000"
                    backgroundColor="#fff"
                  />
                )}
              </View>

              <Text style={[styles.qrHint, { color: colors.textMuted }]}>
                Radius: {session.radius_m}m · Students must be within range
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.endBtn, { borderColor: colors.error, opacity: ending ? 0.7 : 1 }]}
              onPress={handleEndSession}
              disabled={ending}
            >
              {ending ? (
                <ActivityIndicator color={colors.error} />
              ) : (
                <View style={styles.endBtnInner}>
                  <AppIcon name="stop-circle" size={20} color={colors.error} />
                  <Text style={[styles.endBtnText, { color: colors.error }]}>End Session</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={mapVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMapVisible(false)}>
        <SafeArea style={[styles.mapModal, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <View style={[styles.mapHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setMapVisible(false)} hitSlop={12}>
              <Text style={[styles.mapHeaderBtn, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.mapHeaderTitle, { color: colors.text }]}>Session location</Text>
            <TouchableOpacity onPress={confirmMapLocation} hitSlop={12}>
              <Text style={[styles.mapHeaderBtn, { color: colors.primary, fontWeight: '800' }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.mapHint, { color: colors.textSecondary }]}>
            Drag the pin or tap the map. Use "My location" to jump to GPS.
          </Text>

          <View style={[styles.mapWrap, { height: MAP_HEIGHT }]}>
            {Platform.OS === 'web' || !MapView ? (
              <View style={[styles.mapFallback, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: spacing.md }}>
                  Map picker is not available on web. Use the mobile app.
                </Text>
              </View>
            ) : (
              <MapView
                style={StyleSheet.absoluteFill}
                region={mapRegion}
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setMapDraft({ latitude, longitude });
                }}
              >
                <Marker
                  coordinate={mapDraft}
                  draggable
                  onDragEnd={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setMapDraft({ latitude, longitude });
                  }}
                />
              </MapView>
            )}
          </View>

          <TouchableOpacity
            style={[styles.mapFooterBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            onPress={jumpMapToGps}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <AppIcon name="navigate" size={20} color={colors.primary} />
                <Text style={[styles.mapFooterBtnText, { color: colors.text }]}>My location</Text>
              </>
            )}
          </TouchableOpacity>
        </SafeArea>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors, spacing, radius) => StyleSheet.create({
  safe: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: spacing.lg },
  card: { borderRadius: 16, padding: spacing.lg, borderWidth: 1, marginBottom: spacing.lg },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  hintText: { fontSize: 13, marginBottom: spacing.md, lineHeight: 18 },
  lectureChip: {
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
  },
  input: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 15, marginBottom: spacing.md,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  locationText: { fontSize: 13, fontWeight: '500', flex: 1 },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, marginBottom: spacing.sm,
  },
  mapBtnText: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 12, marginBottom: spacing.lg,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },
  btn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  qrCard: {
    borderRadius: 16, padding: spacing.lg, borderWidth: 1,
    alignItems: 'center', width: '100%', marginBottom: spacing.lg,
  },
  qrLectureRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginBottom: 4 },
  qrLecture: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  qrCode: { fontSize: 22, fontWeight: '800', marginBottom: spacing.lg },
  qrBox: {
    padding: 16, backgroundColor: '#fff',
    borderRadius: 16, marginBottom: spacing.md,
  },
  qrHint: { fontSize: 12, textAlign: 'center' },
  endBtn: {
    borderWidth: 1.5, borderRadius: 12, paddingVertical: 14,
    paddingHorizontal: 40, alignItems: 'center',
  },
  endBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  endBtnText: { fontSize: 15, fontWeight: '700' },
  mapModal: { flex: 1 },
  mapHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1,
  },
  mapHeaderTitle: { fontSize: 16, fontWeight: '700' },
  mapHeaderBtn: { fontSize: 16, fontWeight: '600', minWidth: 64 },
  mapHint: { fontSize: 13, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, lineHeight: 18 },
  mapWrap: { width: '100%', marginBottom: spacing.md },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapFooterBtn: {
    marginHorizontal: spacing.lg, marginBottom: spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1,
  },
  mapFooterBtnText: { fontSize: 15, fontWeight: '600' },
});
