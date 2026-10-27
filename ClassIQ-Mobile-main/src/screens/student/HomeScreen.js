import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView, Animated, Dimensions,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppIcon } from '../../components/AppIcon';
import { authStore } from '../../store/authStore';
import axios from 'axios';
import { BASE_URL } from '../../api/auth';
import { fetchLeaderboard } from '../../api/trivia';

const { width } = Dimensions.get('window');

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const AnimatedCard = ({ children, delay, style }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
};

export default function HomeScreen({ route, navigation }) {
  const { colors, spacing, radius } = useTheme();
  const user = route?.params?.user;
  const firstName = user?.name?.split(' ')[0] || 'Student';

  const [attendanceStats, setAttendanceStats] = useState({ total: 0, rate: 0 });
  const [points, setPoints] = useState(0);

  // Trigger morning motivation / feature tips (once per day, server-side)
  useEffect(() => {
    axios.get(`${BASE_URL}/push/check_daily.php`).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const u = user || await authStore.getUser();
        if (!u) return;
        
        const studentId = u.student_id ?? u.id;

        // Fetch attendance
        const attRes = await axios.get(`${BASE_URL}/student/get_attendance.php`, {
          params: { student_id: studentId },
        });
        const records = attRes.data.records || [];
        const total = records.length;
        const present = records.filter(r => r.status === 'Present').length;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        // Fetch trivia points
        const trivRes = await fetchLeaderboard(studentId);
        const myPoints = trivRes.my_stats?.total_points || 0;

        if (mounted) {
          setAttendanceStats({ total, rate });
          setPoints(myPoints);
        }
      } catch (e) {
        // silently fail on home screen
      }
    };
    
    fetchStats();
    
    const unsubscribe = navigation.addListener('focus', () => {
      fetchStats();
    });

    return () => { 
      mounted = false; 
      unsubscribe();
    };
  }, [user, navigation]);

  const actions = [
    {
      icon: 'qr-code-outline',
      label: 'Scan QR',
      desc: 'Mark attendance',
      color: colors.primary,
      bg: colors.primary + '15',
      screen: 'Scanner',
    },
    {
      icon: 'sparkles-outline',
      label: 'AI Study',
      desc: 'Learn with Six',
      color: colors.purple,
      bg: colors.purple + '15',
      screen: 'AIStudy',
    },
    {
      icon: 'trophy-outline',
      label: 'Trivia',
      desc: 'Earn points',
      color: colors.warning,
      bg: colors.warning + '15',
      screen: 'Trivia',
    },
    {
      icon: 'clipboard-outline',
      label: 'Attendance',
      desc: 'View history',
      color: colors.success,
      bg: colors.success + '15',
      screen: 'Attendance',
    },
  ];

  const stats = [
    { label: 'Classes', value: attendanceStats.total.toString(), icon: 'school-outline', color: colors.primary },
    { label: 'Rate', value: `${attendanceStats.rate}%`, icon: 'trending-up-outline', color: colors.success },
    { label: 'Points', value: points.toString(), icon: 'star-outline', color: colors.warning },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
       <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
       >

        {/* ── Header ── */}
        <AnimatedCard delay={0}>
          <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Decorative accent blob */}
            <View style={[styles.headerBlob, { backgroundColor: colors.primary + '18' }]} />

            <View style={styles.headerTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.greeting, { color: colors.textMuted }]}>
                  {getGreeting()} 👋
                </Text>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {firstName}
                </Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {user?.index_number || ''}{user?.department ? ` · ${user.department}` : ''}
                </Text>
              </View>

              {/* Avatar circle */}
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Stats strip */}
            <View style={[styles.statsStrip, { borderTopColor: colors.border }]}>
              {stats.map((s, i) => (
                <View key={i} style={[styles.statItem, i < stats.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </AnimatedCard>

        {/* ── Quick Actions ── */}
        <AnimatedCard delay={80}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Quick Actions</Text>
        </AnimatedCard>

        <View style={styles.actionsGrid}>
          {actions.map((action, i) => (
            <AnimatedCard key={action.screen} delay={120 + i * 60} style={styles.actionWrap}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.75}
              >
                {/* Colored top bar */}
                <View style={[styles.actionBar, { backgroundColor: action.color }]} />

                <View style={styles.actionBody}>
                  <View style={[styles.actionIconWrap, { backgroundColor: action.bg }]}>
                    <AppIcon name={action.icon} size={22} color={action.color} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                  <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>{action.desc}</Text>
                </View>

                <View style={styles.actionArrow}>
                  <AppIcon name="chevron-forward" size={14} color={colors.textMuted} />
                </View>
              </TouchableOpacity>
            </AnimatedCard>
          ))}
        </View>

        {/* ── Trivia Banner ── */}
        <AnimatedCard delay={380}>
          <TouchableOpacity
            style={[styles.triviaBanner, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Trivia')}
            activeOpacity={0.85}
          >
            <View style={[styles.triviaBlob1, { backgroundColor: '#ffffff18' }]} />
            <View style={[styles.triviaBlob2, { backgroundColor: '#ffffff10' }]} />

            <View style={{ flex: 1 }}>
              <Text style={styles.triviaEyebrow}>🔥 Daily Challenge</Text>
              <Text style={styles.triviaTitle}>Play Trivia</Text>
              <Text style={styles.triviaDesc}>Earn points · Climb the leaderboard</Text>
            </View>

            <View style={styles.trophyWrap}>
              <Text style={{ fontSize: 42 }}>🏆</Text>
            </View>
          </TouchableOpacity>
        </AnimatedCard>

        {/* ── Settings shortcut ── */}
        <AnimatedCard delay={440}>
          <TouchableOpacity
            style={[styles.settingsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.75}
          >
            <View style={[styles.settingsIcon, { backgroundColor: colors.surfaceAlt }]}>
              <AppIcon name="settings-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={[styles.settingsLabel, { color: colors.text }]}>Settings & Profile</Text>
            <AppIcon name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </AnimatedCard>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const CARD_WIDTH = (width - 48 - 10) / 2;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingTop: 20 },

  // Header card
  header: {
    borderRadius: 20, borderWidth: 1,
    marginBottom: 24, overflow: 'hidden',
  },
  headerBlob: {
    position: 'absolute', width: 160, height: 160,
    borderRadius: 80, top: -40, right: -40,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center',
    padding: 20, paddingBottom: 16,
  },
  greeting: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  meta: { fontSize: 12 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12,
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  statsStrip: {
    flexDirection: 'row', borderTopWidth: 1,
    paddingVertical: 14,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  // Section title
  sectionTitle: {
    fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 12,
  },

  // Action cards grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  actionWrap: { width: CARD_WIDTH },
  actionCard: {
    borderRadius: 16, borderWidth: 1,
    overflow: 'hidden', position: 'relative',
  },
  actionBar: { height: 3, width: '100%' },
  actionBody: { padding: 14, paddingBottom: 12 },
  actionIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  actionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  actionDesc: { fontSize: 11 },
  actionArrow: { position: 'absolute', bottom: 12, right: 12 },

  // Trivia banner
  triviaBanner: {
    borderRadius: 20, padding: 20,
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 12, overflow: 'hidden',
    position: 'relative',
  },
  triviaBlob1: {
    position: 'absolute', width: 120, height: 120,
    borderRadius: 60, top: -30, right: 60,
  },
  triviaBlob2: {
    position: 'absolute', width: 80, height: 80,
    borderRadius: 40, bottom: -20, right: 20,
  },
  triviaEyebrow: { color: '#ffffffaa', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  triviaTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  triviaDesc: { color: '#ffffffcc', fontSize: 12, marginTop: 4 },
  trophyWrap: { marginLeft: 12 },

  // Settings row
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: 1, gap: 12,
  },
  settingsIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsLabel: { flex: 1, fontSize: 14, fontWeight: '600' },

  sixBanner: {
  borderRadius: 20, padding: 20,
  flexDirection: 'row', alignItems: 'center',
  marginBottom: 12, overflow: 'hidden', position: 'relative',
},
});
