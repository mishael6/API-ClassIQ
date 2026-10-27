import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  ActivityIndicator, TouchableOpacity, RefreshControl, Animated,
  Dimensions, TextInput, Alert,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import { fetchAttendance, fetchSavedLectures, saveLecture, deleteLecture } from '../../api/classrep';
import { AppIcon } from '../../components/AppIcon';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const today = new Date().toISOString().split('T')[0];
const getWeekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

// ── Animated stat card ────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, colors, delay = 0 }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 500, delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      flex: 1,
    }}>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: color + '40' }]}>
        <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
          <AppIcon name={icon} size={16} color={color} />
        </View>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
    </Animated.View>
  );
};

// ── Student row ───────────────────────────────────────────────────────
const StudentRow = ({ item, colors, index }) => {
  const isPresent = item.status === 'Present';
  const isFlagged = item.status === 'Flagged';
  const statusColor = isPresent ? colors.success : isFlagged ? colors.warning : colors.error;

  return (
    <View style={[styles.studentRow, { borderTopColor: colors.border }]}>
      <View style={[styles.studentAvatar, { backgroundColor: colors.primary + '18' }]}>
        <Text style={[styles.studentAvatarText, { color: colors.primary }]}>
          {item.student_name?.charAt(0)?.toUpperCase() || '?'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.studentName, { color: colors.text }]}>{item.student_name}</Text>
        <Text style={[styles.studentIndex, { color: colors.textMuted }]}>{item.index_number}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: statusColor + '18' }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
      </View>
    </View>
  );
};

const QuickActions = ({ colors, navigation }) => {
  const actions = [
    { icon: 'people-outline', label: 'Students', screen: 'Students', color: colors.primary },
    { icon: 'sparkles-outline', label: 'AI Study', screen: 'AIStudy', color: colors.purple },
    { icon: 'trophy-outline', label: 'Trivia', screen: 'Trivia', color: colors.warning },
  ];
  return (
    <View style={qaStyles.row}>
      {actions.map((a) => (
        <TouchableOpacity
          key={a.screen}
          style={[qaStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate(a.screen)}
          activeOpacity={0.75}
        >
          <View style={[qaStyles.iconWrap, { backgroundColor: a.color + '18' }]}>
            <AppIcon name={a.icon} size={20} color={a.color} />
          </View>
          <Text style={[qaStyles.label, { color: colors.text }]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const qaStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700' },
});

export default function DashboardScreen({ route }) {
  const { colors, spacing } = useTheme();
  const user = route?.params?.user;
  const firstName = user?.name?.split(' ')[0] || 'Rep';

  const [records, setRecords] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('daily');
  const [lectures, setLectures] = useState([]);
  const [lectureInput, setLectureInput] = useState('');
  const [lectureSaving, setLectureSaving] = useState(false);
  const [lectureDeleting, setLectureDeleting] = useState(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const navigation = useNavigation();

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1, duration: 700, useNativeDriver: true,
    }).start();
    load();
  }, []);

  const tabs = ['daily', 'weekly', 'semester'];

  const handleTabPress = (tab) => {
    const index = tabs.indexOf(tab);
    Animated.spring(tabIndicatorAnim, {
      toValue: index, useNativeDriver: false, tension: 80, friction: 10,
    }).start();
    setActiveTab(tab);
  };

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const token = await authStore.getToken();
      const [data, lecData] = await Promise.all([
        fetchAttendance(token),
        fetchSavedLectures(token),
      ]);
      setRecords(data);
      setLectures(lecData.lectures || []);
    } catch (e) {
      console.log('Fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddLecture = async () => {
    const name = lectureInput.trim();
    if (!name) return;
    setLectureSaving(true);
    try {
      const token = await authStore.getToken();
      const res = await saveLecture(token, name);
      setLectures(prev => [...prev, { id: res.id, name: res.name || name }]);
      setLectureInput('');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to save lecture.');
    } finally {
      setLectureSaving(false);
    }
  };

  const handleDeleteLecture = (id) => {
    Alert.alert('Delete lecture', 'Remove this lecture name?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLectureDeleting(id);
          try {
            const token = await authStore.getToken();
            await deleteLecture(token, id);
            setLectures(prev => prev.filter(l => l.id !== id));
          } catch {
            Alert.alert('Error', 'Failed to delete lecture.');
          } finally {
            setLectureDeleting(null);
          }
        },
      },
    ]);
  };

  // Flatten records
  const allRows = [];
  Object.entries(records).forEach(([date, lectures]) => {
    Object.entries(lectures).forEach(([lecture, students]) => {
      students.forEach(s => allRows.push({ ...s, attendance_date: date, lecture_name: lecture }));
    });
  });

  const todayRows = allRows.filter(r => r.attendance_date === today);
  const todayLectures = [...new Set(todayRows.map(r => r.lecture_name))];
  const todayPresent = todayRows.filter(r => r.status === 'Present').length;
  const todayFlagged = todayRows.filter(r => r.status === 'Flagged').length;

  const weekStart = getWeekStart();
  const weekRows = allRows.filter(r => r.attendance_date >= weekStart);
  const weekPresent = weekRows.filter(r => r.status === 'Present').length;
  const weekDates = [...new Set(weekRows.map(r => r.attendance_date))];

  const totalPresent = allRows.filter(r => r.status === 'Present').length;
  const totalFlagged = allRows.filter(r => r.status === 'Flagged').length;
  const totalDates = [...new Set(allRows.map(r => r.attendance_date))];
  const totalLectures = [...new Set(allRows.map(r => r.lecture_name))];

  const tabWidth = (width - 32) / 3;
  const indicatorLeft = tabIndicatorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, tabWidth, tabWidth * 2],
  });

  // ── Daily ─────────────────────────────────────────────────────────────
  const renderDaily = () => (
    <View>
      <QuickActions colors={colors} navigation={navigation} />

      <View style={[styles.lecturesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.lecturesTitle, { color: colors.text }]}>My Lectures</Text>
        <Text style={[styles.lecturesSub, { color: colors.textSecondary }]}>
          Add lectures you teach — pick from this list when generating QR
        </Text>
        <View style={styles.lectureInputRow}>
          <TextInput
            style={[styles.lectureInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            placeholder="e.g. Data Structures"
            placeholderTextColor={colors.textMuted}
            value={lectureInput}
            onChangeText={setLectureInput}
            editable={!lectureSaving}
          />
          <TouchableOpacity
            style={[styles.lectureAddBtn, { backgroundColor: colors.primary, opacity: lectureSaving || !lectureInput.trim() ? 0.5 : 1 }]}
            onPress={handleAddLecture}
            disabled={lectureSaving || !lectureInput.trim()}
          >
            {lectureSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.lectureAddText}>Add</Text>}
          </TouchableOpacity>
        </View>
        {lectures.length === 0 ? (
          <Text style={[styles.lecturesEmpty, { color: colors.textMuted }]}>No lectures saved yet.</Text>
        ) : (
          lectures.map(lec => (
            <View key={lec.id} style={[styles.lectureRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.lectureRowText, { color: colors.text }]} numberOfLines={1}>{lec.name}</Text>
              <TouchableOpacity onPress={() => handleDeleteLecture(lec.id)} disabled={lectureDeleting === lec.id}>
                <AppIcon name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Present" value={todayPresent} icon="checkmark-circle-outline" color={colors.success} colors={colors} delay={0} />
        <StatCard label="Flagged" value={todayFlagged} icon="flag-outline" color={colors.warning} colors={colors} delay={80} />
        <StatCard label="Lectures" value={todayLectures.length} icon="book-outline" color={colors.primary} colors={colors} delay={160} />
      </View>

      {todayLectures.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No lectures today</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Generate a QR code to start taking attendance
          </Text>
        </View>
      ) : (
        todayLectures.map((lecture, li) => {
          const students = todayRows.filter(r => r.lecture_name === lecture);
          const presentCount = students.filter(s => s.status === 'Present').length;
          return (
            <View key={lecture} style={[styles.lectureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.lectureCardTop, { backgroundColor: colors.primary }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lectureName}>{lecture}</Text>
                  <Text style={styles.lectureDate}>Today · {formatDate(today)}</Text>
                </View>
                <View style={styles.lectureCountBadge}>
                  <Text style={styles.lectureCountText}>{presentCount}/{students.length}</Text>
                  <Text style={styles.lectureCountLabel}>present</Text>
                </View>
              </View>
              <View style={styles.lectureBody}>
                {students.map((s, i) => <StudentRow key={i} item={s} colors={colors} index={i} />)}
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  // ── Weekly ────────────────────────────────────────────────────────────
  const renderWeekly = () => (
    <View>
      <QuickActions colors={colors} navigation={navigation} /> 
      <View style={styles.statsRow}>
        <StatCard label="Present" value={weekPresent} icon="people-outline" color={colors.success} colors={colors} delay={0} />
        <StatCard label="Days Active" value={weekDates.length} icon="calendar-outline" color={colors.primary} colors={colors} delay={80} />
        <StatCard label="Avg/Day" value={weekDates.length ? Math.round(weekPresent / weekDates.length) : 0} icon="trending-up-outline" color={colors.purple} colors={colors} delay={160} />
      </View>

      {weekDates.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>📅</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No attendance this week</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Records will appear as students mark attendance</Text>
        </View>
      ) : (
        weekDates.map((date) => {
          const dayRows = weekRows.filter(r => r.attendance_date === date);
          const lectures = [...new Set(dayRows.map(r => r.lecture_name))];
          return (
            <View key={date} style={[styles.lectureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.lectureCardTop, { backgroundColor: colors.purple }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lectureName}>{formatDate(date)}</Text>
                  <Text style={styles.lectureDate}>{lectures.length} lecture(s)</Text>
                </View>
                <View style={styles.lectureCountBadge}>
                  <Text style={styles.lectureCountText}>{dayRows.length}</Text>
                  <Text style={styles.lectureCountLabel}>present</Text>
                </View>
              </View>
              <View style={styles.lectureBody}>
                {lectures.map((l, i) => {
                  const count = dayRows.filter(r => r.lecture_name === l).length;
                  return (
                    <View key={i} style={[styles.weekLectureRow, { borderTopColor: colors.border }]}>
                      <View style={[styles.weekLectureIcon, { backgroundColor: colors.purple + '18' }]}>
                        <AppIcon name="book-outline" size={14} color={colors.purple} />
                      </View>
                      <Text style={[styles.weekLectureName, { color: colors.text }]}>{l}</Text>
                      <Text style={[styles.weekLectureCount, { color: colors.success }]}>{count} present</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  // ── Semester ──────────────────────────────────────────────────────────
  const renderSemester = () => {
    const counts = {};
    allRows.filter(r => r.status === 'Present').forEach(r => {
      counts[r.index_number] = counts[r.index_number] || { name: r.student_name, count: 0 };
      counts[r.index_number].count++;
    });
    const topStudents = Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    const medals = ['🥇', '🥈', '🥉'];

    return (
      <View>
        <QuickActions colors={colors} navigation={navigation} /> 
        <View style={styles.statsRow}>
          <StatCard label="Total" value={totalPresent} icon="checkmark-circle-outline" color={colors.success} colors={colors} delay={0} />
          <StatCard label="Flagged" value={totalFlagged} icon="flag-outline" color={colors.warning} colors={colors} delay={80} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Days" value={totalDates.length} icon="calendar-outline" color={colors.primary} colors={colors} delay={160} />
          <StatCard label="Lectures" value={totalLectures.length} icon="book-outline" color={colors.purple} colors={colors} delay={240} />
        </View>

        {topStudents.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={{ fontSize: 18 }}>🏆</Text>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Students</Text>
            </View>

            {topStudents.map(([idx, info], i) => (
              <View key={idx} style={[styles.topCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.topMedal}>{medals[i] || `#${i + 1}`}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.studentName, { color: colors.text }]}>{info.name}</Text>
                  <Text style={[styles.studentIndex, { color: colors.textMuted }]}>{idx}</Text>
                </View>
                <View style={[styles.topCountBadge, { backgroundColor: colors.success + '18' }]}>
                  <Text style={[styles.topCountText, { color: colors.success }]}>{info.count}</Text>
                  <Text style={[styles.topCountLabel, { color: colors.success }]}>classes</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>

      {/* Hero header */}
      <Animated.View style={[
        styles.hero,
        { backgroundColor: colors.primary },
        { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] },
      ]}>
        <View style={[styles.heroBlob1, { backgroundColor: '#ffffff15' }]} />
        <View style={[styles.heroBlob2, { backgroundColor: '#ffffff08' }]} />
        <View style={styles.heroContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋</Text>
            <Text style={styles.heroName}>{firstName}</Text>
            <Text style={styles.heroSub}>{user?.program || 'Class Representative'}</Text>
          </View>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>{firstName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.heroStats}>
          {[
            { label: "Today's Present", value: todayPresent },
            { label: 'This Week', value: weekPresent },
            { label: 'All Time', value: totalPresent },
          ].map((s, i) => (
            <View key={i} style={[styles.heroStat, i < 2 && { borderRightWidth: 1, borderRightColor: '#ffffff30' }]}>
              <Text style={styles.heroStatValue}>{s.value}</Text>
              <Text style={styles.heroStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Animated.View style={[styles.tabIndicator, { width: tabWidth, left: indicatorLeft, backgroundColor: colors.primary + '18' }]} />
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, { width: tabWidth }]}
            onPress={() => handleTabPress(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === tab ? colors.primary : colors.textMuted },
            ]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            {activeTab === tab && <View style={[styles.tabDot, { backgroundColor: colors.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading attendance...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
        >
          {activeTab === 'daily' && renderDaily()}
          {activeTab === 'weekly' && renderWeekly()}
          {activeTab === 'semester' && renderSemester()}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Hero
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0, overflow: 'hidden', position: 'relative' },
  heroBlob1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -40, right: -40 },
  heroBlob2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, bottom: 20, left: -20 },
  heroContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  heroGreeting: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  heroName: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 3 },
  heroAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  heroAvatarText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  heroStat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  heroStatValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' },

  // Tabs
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    position: 'relative', height: 48,
  },
  tabIndicator: { position: 'absolute', top: 0, bottom: 0, borderRadius: 0 },
  tab: { alignItems: 'center', justifyContent: 'center', height: 48 },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 },

  // Content
  scrollContent: { padding: 16 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: { borderRadius: 14, padding: 14, borderWidth: 1, alignItems: 'center', gap: 6 },
  statIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 26, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },

  // Lecture card
  lectureCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  lectureCardTop: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  lectureName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  lectureDate: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  lectureCountBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 10 },
  lectureCountText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  lectureCountLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },
  lectureBody: { padding: 8 },

  // Student row
  studentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: 1, gap: 10 },
  studentAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  studentAvatarText: { fontSize: 14, fontWeight: '800' },
  studentName: { fontSize: 14, fontWeight: '600' },
  studentIndex: { fontSize: 11, marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },

  // Weekly
  weekLectureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderTopWidth: 1, gap: 10 },
  weekLectureIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  weekLectureName: { flex: 1, fontSize: 14, fontWeight: '600' },
  weekLectureCount: { fontSize: 13, fontWeight: '700' },

  // Semester
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  topCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  topMedal: { fontSize: 24, width: 36 },
  topCountBadge: { alignItems: 'center', padding: 10, borderRadius: 12 },
  topCountText: { fontSize: 20, fontWeight: '900' },
  topCountLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  // Saved lectures (dashboard management)
  lecturesCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  lecturesTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  lecturesSub: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  lectureInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  lectureInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  lectureAddBtn: { borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  lectureAddText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  lecturesEmpty: { fontSize: 13, fontStyle: 'italic' },
  lectureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, gap: 10 },
  lectureRowText: { flex: 1, fontSize: 14, fontWeight: '600' },

  // Empty
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center', marginTop: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});