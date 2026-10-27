import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, SafeAreaView,
  ActivityIndicator, TouchableOpacity, Modal, TextInput,
  Alert, KeyboardAvoidingView, Platform, Animated, LayoutAnimation, UIManager,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import axios from 'axios';
import { BASE_URL } from '../../api/auth';
import { fetchSavedLectures } from '../../api/classrep';
import { AppIcon } from '../../components/AppIcon';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

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

const StatusBadge = ({ status }) => {
  const { colors, radius } = useTheme();
  const isPresent = status === 'Present';
  const isFlagged = status === 'Flagged';
  const color = isPresent ? colors.success : isFlagged ? colors.warning : colors.error;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: color + '22' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{status}</Text>
    </View>
  );
};

const FadeInView = ({ children, delay = 0, style }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 420, delay, useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[style, {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
};

export default function ClassrepAttendanceScreen() {
  const { colors, spacing } = useTheme();

  const [dateGroups, setDateGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedLectures, setExpandedLectures] = useState({});
  const [stats, setStats] = useState({ total: 0, present: 0, flagged: 0, outside: 0 });
  const [token, setToken] = useState(null);
  const [savedLectures, setSavedLectures] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [lectureName, setLectureName] = useState('');
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0]);
  const [addStatus, setAddStatus] = useState('Present');
  const [addLoading, setAddLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    (async () => {
      const t = await authStore.getToken();
      setToken(t);
      await fetchAttendance(t);
      await fetchStudents(t);
      try {
        const lecData = await fetchSavedLectures(t);
        setSavedLectures(lecData.lectures || []);
      } catch { /* silent */ }
    })();
  }, []);

  const fetchAttendance = async (t) => {
    try {
      const res = await axios.get(`${BASE_URL}/classrep/attendance.php`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const raw = res.data.records || {};
      let total = 0, present = 0, flagged = 0, outside = 0;
      const groups = [];

      Object.entries(raw)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([date, lectures]) => {
          const lectureList = Object.entries(lectures).map(([lecture, studs]) => {
            const p = studs.filter(s => s.status === 'Present').length;
            const f = studs.filter(s => s.status === 'Flagged').length;
            const o = studs.filter(s => s.status === 'Outside').length;
            total += studs.length;
            present += p;
            flagged += f;
            outside += o;
            return {
              key: `${date}::${lecture}`,
              lecture,
              data: studs,
              present: p,
              flagged: f,
              outside: o,
            };
          });
          groups.push({
            key: date,
            date,
            label: formatDateLabel(date),
            shortLabel: formatDateShort(date),
            lectures: lectureList,
            totalStudents: lectureList.reduce((s, l) => s + l.data.length, 0),
          });
        });

      setStats({ total, present, flagged, outside });
      setDateGroups(groups);

      if (groups.length > 0) {
        const first = groups[0];
        setExpandedDates({ [first.key]: true });
        if (first.lectures[0]) {
          setExpandedLectures({ [first.lectures[0].key]: true });
        }
      }
    } catch {
      setDateGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (t) => {
    try {
      const res = await axios.get(`${BASE_URL}/classrep/students.php`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const d = res.data;
      if (Array.isArray(d)) setStudents(d);
      else if (Array.isArray(d.students)) setStudents(d.students);
      else if (Array.isArray(d.data)) setStudents(d.data);
    } catch { /* silent */ }
  };

  const handleAddAttendance = async () => {
    if (!selectedStudent) return Alert.alert('Missing', 'Please search and select a student.');
    if (!lectureName.trim()) return Alert.alert('Missing', 'Please select a lecture.');
    setAddLoading(true);
    try {
      await axios.post(`${BASE_URL}/classrep/add_attendance.php`, {
        index_number: selectedStudent.index_number,
        lecture_name: lectureName.trim(),
        attendance_date: addDate,
        status: addStatus,
      }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert('Success', 'Attendance added!');
      setShowAddModal(false);
      setSelectedStudent(null);
      setLectureName('');
      setStudentSearch('');
      setAddStatus('Present');
      setLoading(true);
      await fetchAttendance(token);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to add attendance.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      let csv = 'Date,Lecture,Student Name,Index Number,Status,Time\n';
      dateGroups.forEach(group => {
        group.lectures.forEach(lec => {
          lec.data.forEach(s => {
            csv += `"${group.label}",${lec.lecture},"${s.student_name}",${s.index_number},${s.status},${s.time_marked}\n`;
          });
        });
      });
      const fileUri = FileSystem.documentDirectory + 'ClassIQ_Attendance.csv';
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Attendance',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Export', 'Sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Export failed', e.message);
    }
  };

  const toggleDate = (key) => {
    animateToggle();
    setExpandedDates(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleLecture = (key) => {
    animateToggle();
    setExpandedLectures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;

  const filteredStudents = studentSearch.length > 0
    ? students.filter(s =>
        s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.index_number?.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : [];

  const renderStudent = (student, i) => (
    <FadeInView key={`${student.index_number}-${i}`} delay={i * 40} style={{ marginBottom: 6 }}>
      <View style={[
        styles.studentRow,
        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        student.status === 'Flagged' && { borderLeftWidth: 3, borderLeftColor: colors.warning },
        student.status === 'Outside' && { borderLeftWidth: 3, borderLeftColor: colors.error },
        student.status === 'Present' && { borderLeftWidth: 3, borderLeftColor: colors.success },
      ]}>
        <View style={[styles.avatarSmall, { backgroundColor: colors.primary + '22' }]}>
          <Text style={[styles.avatarLetter, { color: colors.primary }]}>
            {student.student_name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.studentName, { color: colors.text }]}>{student.student_name}</Text>
          <Text style={[styles.studentIndex, { color: colors.textMuted }]}>{student.index_number}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <StatusBadge status={student.status} />
          <Text style={[styles.timeText, { color: colors.textMuted }]}>{formatTime(student.time_marked)}</Text>
        </View>
      </View>
    </FadeInView>
  );

  const renderDateGroup = ({ item: group, index }) => {
    const dateOpen = !!expandedDates[group.key];
    return (
      <FadeInView delay={index * 60} style={{ marginBottom: 16 }}>
        <TouchableOpacity
          style={[styles.dateHeader, { backgroundColor: colors.primary }]}
          onPress={() => toggleDate(group.key)}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.dateTitle}>{group.label}</Text>
            <Text style={styles.dateSub}>
              {group.shortLabel} · {group.lectures.length} lecture{group.lectures.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{group.totalStudents}</Text>
          </View>
          <AppIcon
            name={dateOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="rgba(255,255,255,0.9)"
          />
        </TouchableOpacity>

        {dateOpen && group.lectures.map((lec, li) => {
          const lecOpen = !!expandedLectures[lec.key];
          return (
            <View key={lec.key} style={[styles.lectureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.lectureHead}
                onPress={() => toggleLecture(lec.key)}
                activeOpacity={0.75}
              >
                <View style={[styles.lectureIcon, { backgroundColor: colors.primary + '15' }]}>
                  <AppIcon name="book-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lectureName, { color: colors.text }]}>{lec.lecture}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[styles.miniBadge, { backgroundColor: colors.success + '22' }]}>
                      <Text style={[styles.miniBadgeText, { color: colors.success }]}>{lec.present} present</Text>
                    </View>
                    {lec.flagged > 0 && (
                      <View style={[styles.miniBadge, { backgroundColor: colors.warning + '22' }]}>
                        <Text style={[styles.miniBadgeText, { color: colors.warning }]}>{lec.flagged} flagged</Text>
                      </View>
                    )}
                    <View style={[styles.miniBadge, { backgroundColor: colors.surfaceAlt }]}>
                      <Text style={[styles.miniBadgeText, { color: colors.textMuted }]}>{lec.data.length} total</Text>
                    </View>
                  </View>
                </View>
                <AppIcon name={lecOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </TouchableOpacity>

              {lecOpen && (
                <View style={[styles.studentList, { borderTopColor: colors.border }]}>
                  {lec.data.map((student, i) => renderStudent(student, i))}
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

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Attendance</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Grouped by date & lecture
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.success + '18', borderColor: colors.success + '40' }]}
            onPress={() => setShowAddModal(true)}
          >
            <AppIcon name="person-add-outline" size={16} color={colors.success} />
            <Text style={[styles.headerBtnText, { color: colors.success }]}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}
            onPress={handleExport}
          >
            <AppIcon name="download-outline" size={16} color={colors.primary} />
            <Text style={[styles.headerBtnText, { color: colors.primary }]}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!loading && stats.total > 0 && (
        <FadeInView style={styles.statsRow}>
          {[
            { label: 'Total', value: stats.total, color: colors.primary },
            { label: 'Present', value: stats.present, color: colors.success },
            { label: 'Flagged', value: stats.flagged, color: colors.warning },
            { label: 'Rate', value: `${rate}%`, color: rate >= 75 ? colors.success : colors.error },
          ].map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </FadeInView>
      )}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : dateGroups.length === 0 ? (
        <FadeInView style={styles.empty}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Attendance Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Generate a QR code or add students manually.
          </Text>
        </FadeInView>
      ) : (
        <FlatList
          data={dateGroups}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={renderDateGroup}
        />
      )}

      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Attendance</Text>
                <TouchableOpacity onPress={() => {
                  setShowAddModal(false);
                  setSelectedStudent(null);
                  setStudentSearch('');
                }}>
                  <AppIcon name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={[]}
                keyExtractor={() => 'form'}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  <View style={styles.modalBody}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Search Student *</Text>
                    <View style={[styles.searchWrap, { backgroundColor: colors.surfaceAlt, borderColor: selectedStudent ? colors.success : colors.border }]}>
                      <AppIcon name="search-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Type name or index number..."
                        placeholderTextColor={colors.textMuted}
                        value={studentSearch}
                        onChangeText={(text) => {
                          setStudentSearch(text);
                          if (selectedStudent) setSelectedStudent(null);
                        }}
                        autoCorrect={false}
                      />
                      {selectedStudent && <AppIcon name="checkmark-circle" size={18} color={colors.success} />}
                    </View>

                    {selectedStudent && (
                      <View style={[styles.selectedChip, { backgroundColor: colors.success + '15', borderColor: colors.success + '40' }]}>
                        <AppIcon name="person" size={14} color={colors.success} />
                        <Text style={[styles.selectedChipText, { color: colors.success }]}>
                          {selectedStudent.name} — {selectedStudent.index_number}
                        </Text>
                        <TouchableOpacity onPress={() => { setSelectedStudent(null); setStudentSearch(''); }}>
                          <AppIcon name="close-circle" size={16} color={colors.success} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {studentSearch.length > 0 && !selectedStudent && (
                      <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {filteredStudents.length === 0 ? (
                          <View style={styles.dropdownEmpty}>
                            <Text style={[styles.dropdownEmptyText, { color: colors.textMuted }]}>No students found</Text>
                          </View>
                        ) : (
                          filteredStudents.slice(0, 6).map((item) => (
                            <TouchableOpacity
                              key={item.id?.toString()}
                              style={[styles.dropdownRow, { borderBottomColor: colors.border }]}
                              onPress={() => {
                                setSelectedStudent(item);
                                setStudentSearch(item.name);
                              }}
                            >
                              <View style={[styles.avatarTiny, { backgroundColor: colors.primary + '22' }]}>
                                <Text style={[styles.avatarTinyText, { color: colors.primary }]}>
                                  {item.name?.charAt(0)?.toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.dropdownName, { color: colors.text }]}>{item.name}</Text>
                                <Text style={[styles.dropdownIndex, { color: colors.textMuted }]}>{item.index_number}</Text>
                              </View>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    )}

                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Lecture *</Text>
                    {savedLectures.length === 0 ? (
                      <Text style={[styles.hintText, { color: colors.warning }]}>
                        Add lectures on your Dashboard first.
                      </Text>
                    ) : (
                      <View style={styles.lectureChipRow}>
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
                              <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>
                                {lec.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date</Text>
                    <Text style={[styles.dateDisplay, { color: colors.text, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                      {formatDateLabel(addDate)}
                    </Text>

                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Status</Text>
                    <View style={styles.statusRow}>
                      {['Present', 'Flagged'].map(s => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.statusBtn,
                            { borderColor: colors.border },
                            addStatus === s && {
                              backgroundColor: s === 'Present' ? colors.success + '22' : colors.warning + '22',
                              borderColor: s === 'Present' ? colors.success : colors.warning,
                            },
                          ]}
                          onPress={() => setAddStatus(s)}
                        >
                          <Text style={[
                            styles.statusBtnText,
                            { color: addStatus === s ? (s === 'Present' ? colors.success : colors.warning) : colors.textMuted },
                          ]}>
                            {s}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={[styles.submitBtn, { backgroundColor: colors.primary }, (addLoading || !lectureName) && { opacity: 0.6 }]}
                      onPress={handleAddAttendance}
                      disabled={addLoading || !lectureName}
                    >
                      {addLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.submitBtnText}>Add Attendance</Text>
                      }
                    </TouchableOpacity>
                    <View style={{ height: 20 }} />
                  </View>
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  headerBtnText: { fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  statCard: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },

  dateHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 16, marginBottom: 10,
  },
  dateTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  dateSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 3 },
  dateBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, minWidth: 32, alignItems: 'center',
  },
  dateBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  lectureCard: { borderRadius: 14, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  lectureHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  lectureIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  lectureName: { fontSize: 15, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  miniBadgeText: { fontSize: 11, fontWeight: '600' },
  studentList: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4, borderTopWidth: 1 },
  studentRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderRadius: 10, borderWidth: 1 },
  avatarSmall: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 14, fontWeight: '800' },
  studentName: { fontSize: 13, fontWeight: '600' },
  studentIndex: { fontSize: 11, marginTop: 1 },
  timeText: { fontSize: 11 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  hintText: { fontSize: 13, marginBottom: 8 },
  lectureChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lectureChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  dateDisplay: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  statusBtnText: { fontSize: 14, fontWeight: '700' },
  submitBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 14 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  selectedChipText: { flex: 1, fontSize: 13, fontWeight: '600' },
  dropdown: { borderRadius: 12, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  dropdownRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1 },
  dropdownName: { fontSize: 14, fontWeight: '600' },
  dropdownIndex: { fontSize: 12, marginTop: 1 },
  dropdownEmpty: { padding: 16, alignItems: 'center' },
  dropdownEmptyText: { fontSize: 13 },
  avatarTiny: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarTinyText: { fontSize: 12, fontWeight: '800' },
});
