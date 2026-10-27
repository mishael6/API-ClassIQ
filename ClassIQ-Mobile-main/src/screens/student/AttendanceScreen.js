import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  ActivityIndicator, TouchableOpacity, Animated, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import axios from 'axios';
import { BASE_URL } from '../../api/auth';
import { AppIcon } from '../../components/AppIcon';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const animateToggle = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

const formatDateLabel = (dateStr) => {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};

const formatDateShort = (dateStr) => {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatTime = (t) => {
  if (!t) return '—';
  const parts = t.split(':');
  if (parts.length < 2) return t;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

const isToday = (dateStr) => {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
};

const FadeInView = ({ children, delay = 0, style }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 450, delay, useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[style, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
};

const StatusBadge = ({ status }) => {
  const { colors, radius } = useTheme();
  const isPresent = status === 'Present';
  const isFlagged = status === 'Flagged';
  const color = isPresent ? colors.success : isFlagged ? colors.warning : colors.error;
  const icon = isPresent ? 'checkmark-circle' : isFlagged ? 'flag' : 'location-outline';

  return (
    <View style={[styles.statusBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <AppIcon name={icon} size={12} color={color} />
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{status}</Text>
    </View>
  );
};

export default function StudentAttendanceScreen({ route, navigation }) {
  const { colors, spacing, radius } = useTheme();
  const successMessage = route?.params?.successMessage;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedLectures, setExpandedLectures] = useState({});
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchAttendance();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => { fetchAttendance(); }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        navigation.setParams({ successMessage: undefined });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, navigation]);

  const fetchAttendance = async () => {
    try {
      const u = await authStore.getUser();
      setStudentName(u?.name?.split(' ')[0] || 'there');
      const res = await axios.get(`${BASE_URL}/student/get_attendance.php`, {
        params: { student_id: u?.id },
      });
      setRecords(res.data.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const dateGroups = useMemo(() => {
    const byDate = {};
    records.forEach((r) => {
      const d = r.attendance_date;
      const lec = r.lecture_name || 'Lecture';
      if (!byDate[d]) byDate[d] = {};
      if (!byDate[d][lec]) byDate[d][lec] = [];
      byDate[d][lec].push(r);
    });

    return Object.entries(byDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, lectures]) => {
        const lectureList = Object.entries(lectures).map(([lecture, items]) => ({
          key: `${date}::${lecture}`,
          lecture,
          items: items.sort((a, b) => (b.time_marked || '').localeCompare(a.time_marked || '')),
          present: items.filter(i => i.status === 'Present').length,
        }));
        return {
          key: date,
          date,
          label: formatDateLabel(date),
          shortLabel: formatDateShort(date),
          isToday: isToday(date),
          lectures: lectureList,
          total: lectureList.reduce((s, l) => s + l.items.length, 0),
        };
      });
  }, [records]);

  useEffect(() => {
    if (dateGroups.length > 0 && Object.keys(expandedDates).length === 0) {
      const first = dateGroups[0];
      setExpandedDates({ [first.key]: true });
      if (first.lectures[0]) {
        setExpandedLectures({ [first.lectures[0].key]: true });
      }
    }
  }, [dateGroups]);

  const total = records.length;
  const present = records.filter(r => r.status === 'Present').length;
  const flagged = records.filter(r => r.status === 'Flagged').length;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  const toggleDate = (key) => {
    animateToggle();
    setExpandedDates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleLecture = (key) => {
    animateToggle();
    setExpandedLectures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderRecord = (item, i) => (
    <FadeInView key={item.id?.toString() || i} delay={i * 35}>
      <View style={[
        styles.recordCard,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        item.status === 'Present' && { borderLeftWidth: 3, borderLeftColor: colors.success },
        item.status === 'Flagged' && { borderLeftWidth: 3, borderLeftColor: colors.warning },
        item.status === 'Outside' && { borderLeftWidth: 3, borderLeftColor: colors.error },
      ]}>
        <View style={[styles.recordIcon, { backgroundColor: colors.primary + '15' }]}>
          <AppIcon name="time-outline" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.recordTime, { color: colors.text }]}>{formatTime(item.time_marked)}</Text>
          <Text style={[styles.recordMeta, { color: colors.textMuted }]}>Marked at session</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
    </FadeInView>
  );

  const renderDateGroup = ({ item: group, index }) => {
    const dateOpen = !!expandedDates[group.key];
    return (
      <FadeInView delay={index * 55} style={{ marginBottom: 16 }}>
        <TouchableOpacity
          style={[
            styles.dateHeader,
            { backgroundColor: group.isToday ? colors.success : colors.primary },
          ]}
          onPress={() => toggleDate(group.key)}
          activeOpacity={0.88}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.dateTitleRow}>
              <AppIcon name="calendar-outline" size={16} color="#fff" />
              <Text style={styles.dateTitle}>{group.label}</Text>
            </View>
            <Text style={styles.dateSub}>
              {group.shortLabel}
              {group.isToday ? ' · Today' : ''}
              {' · '}{group.lectures.length} lecture{group.lectures.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.dateCountBadge}>
            <Text style={styles.dateCountText}>{group.total}</Text>
          </View>
          <AppIcon
            name={dateOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="rgba(255,255,255,0.9)"
          />
        </TouchableOpacity>

        {dateOpen && group.lectures.map((lec) => {
          const lecOpen = !!expandedLectures[lec.key];
          return (
            <View
              key={lec.key}
              style={[styles.lectureSection, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <TouchableOpacity
                style={styles.lectureHead}
                onPress={() => toggleLecture(lec.key)}
                activeOpacity={0.75}
              >
                <View style={[styles.lectureIcon, { backgroundColor: colors.purple + '15' }]}>
                  <AppIcon name="book-outline" size={18} color={colors.purple || colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lectureName, { color: colors.text }]}>{lec.lecture}</Text>
                  <Text style={[styles.lectureSub, { color: colors.textMuted }]}>
                    {lec.items.length} record{lec.items.length !== 1 ? 's' : ''}
                    {lec.present > 0 ? ` · ${lec.present} present` : ''}
                  </Text>
                </View>
                <AppIcon
                  name={lecOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {lecOpen && (
                <View style={[styles.recordList, { borderTopColor: colors.border }]}>
                  {lec.items.map((item, i) => renderRecord(item, i))}
                </View>
              )}
            </View>
          );
        })}
      </FadeInView>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>

      <FadeInView style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Attendance</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {studentName ? `Hey ${studentName} — ` : ''}your history by date & lecture
        </Text>
      </FadeInView>

      {!!successMessage && (
        <FadeInView style={{ marginHorizontal: 20, marginBottom: 14 }}>
          <View style={[styles.successBanner, {
            backgroundColor: colors.success + '18',
            borderColor: colors.success + '40',
            borderRadius: radius.md,
          }]}>
            <AppIcon name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success }]}>{successMessage}</Text>
          </View>
        </FadeInView>
      )}

      {!loading && total > 0 && (
        <FadeInView delay={80} style={styles.statsRow}>
          {[
            { label: 'Sessions', value: total, color: colors.primary, icon: 'layers-outline' },
            { label: 'Present', value: present, color: colors.success, icon: 'checkmark-circle-outline' },
            { label: 'Flagged', value: flagged, color: colors.warning, icon: 'flag-outline' },
            { label: 'Rate', value: `${rate}%`, color: rate >= 75 ? colors.success : colors.error, icon: 'trending-up-outline' },
          ].map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppIcon name={s.icon} size={14} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </FadeInView>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading your attendance…</Text>
        </View>
      ) : dateGroups.length === 0 ? (
        <FadeInView style={styles.empty}>
          <Text style={{ fontSize: 52, marginBottom: 8 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Records Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Scan a QR code in class and your attendance will show up here, grouped by date and lecture.
          </Text>
        </FadeInView>
      ) : (
        <FlatList
          data={dateGroups}
          keyExtractor={(item) => item.key}
          renderItem={renderDateGroup}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderWidth: 1,
  },
  successText: { flex: 1, fontWeight: '600', fontSize: 13, lineHeight: 18 },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4,
    borderRadius: 14, borderWidth: 1, gap: 4,
  },
  statValue: { fontSize: 17, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  list: { paddingHorizontal: 20, paddingBottom: 40 },

  dateHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 16, marginBottom: 8,
  },
  dateTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateTitle: { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1 },
  dateSub: { color: 'rgba(255,255,255,0.82)', fontSize: 11, marginTop: 4, marginLeft: 24 },
  dateCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, minWidth: 28, alignItems: 'center',
  },
  dateCountText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  lectureSection: {
    borderRadius: 14, borderWidth: 1, marginBottom: 8, overflow: 'hidden',
  },
  lectureHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  lectureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  lectureName: { fontSize: 15, fontWeight: '700' },
  lectureSub: { fontSize: 12, marginTop: 3 },

  recordList: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4, borderTopWidth: 1, gap: 6 },
  recordCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  recordIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recordTime: { fontSize: 14, fontWeight: '700' },
  recordMeta: { fontSize: 11, marginTop: 2 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 40 },
  loadingText: { fontSize: 14 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
});
