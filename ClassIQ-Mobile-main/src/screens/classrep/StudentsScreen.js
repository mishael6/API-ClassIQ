import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { authStore } from '../../store/authStore';
import { fetchStudents } from '../../api/classrep';
import { AppIcon } from '../../components/AppIcon';

const normalizeList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.students)) return payload.students;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

export default function StudentsScreen({ route }) {
  const { colors, spacing, radius } = useTheme();
  const user = route?.params?.user;
  const styles = useMemo(() => makeStyles(colors, spacing, radius), [colors, spacing, radius]);

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const token = await authStore.getToken();
      const list = await fetchStudents(token);
      setStudents(normalizeList(list));
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Could not load students. Check that classrep/students.php exists and your token is valid.';
      setError(msg);
      setStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name = (s.name || s.student_name || '').toLowerCase();
      const idx = (s.index_number || '').toLowerCase();
      const dept = (s.department || '').toLowerCase();
      const prog = (s.program || '').toLowerCase();
      return name.includes(q) || idx.includes(q) || dept.includes(q) || prog.includes(q);
    });
  }, [students, query]);

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + '22' }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {(item.name || item.student_name || '?')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardMain}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name || item.student_name || 'Unknown'}
          </Text>
          <Text style={[styles.index, { color: colors.primary }]} numberOfLines={1}>
            {item.index_number || '—'}
          </Text>
        </View>
      </View>
      {(item.department || item.program || item.level) ? (
        <View style={styles.metaRow}>
          {item.department ? (
            <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.department}
            </Text>
          ) : null}
          {item.program ? (
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
              {item.program}
            </Text>
          ) : null}
          {item.level ? (
            <Text style={[styles.badge, { color: colors.text, backgroundColor: colors.surfaceAlt }]}>
              {item.level}
            </Text>
          ) : null}
        </View>
      ) : null}
      {(item.email || item.phone) ? (
        <View style={[styles.contact, { borderTopColor: colors.border }]}>
          {item.email ? (
            <View style={styles.contactLine}>
              <AppIcon name="mail-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.contactText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.email}
              </Text>
            </View>
          ) : null}
          {item.phone ? (
            <View style={styles.contactLine}>
              <AppIcon name="call-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.contactText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.phone}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>Students</Text>
      <Text style={[styles.screenSub, { color: colors.textSecondary }]}>
        {user?.department || user?.program
          ? `${user.department || ''}${user.department && user.program ? ' · ' : ''}${user.program || ''}`
          : 'Your class roster'}
      </Text>
      <View style={[styles.searchWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <AppIcon name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search name, index, department…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <AppIcon name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {!loading && !error ? (
        <Text style={[styles.countLine, { color: colors.textMuted }]}>
          {filtered.length === students.length
            ? `${students.length} student${students.length === 1 ? '' : 's'}`
            : `${filtered.length} of ${students.length} shown`}
        </Text>
      ) : null}
    </View>
  );

  if (loading && students.length === 0 && !error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        {listHeader}
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Loading roster…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && students.length === 0) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        {listHeader}
        <View style={styles.centerFill}>
          <AppIcon name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Unable to load</Text>
          <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => load(false)}
          >
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <FlatList
        data={filtered}
        keyExtractor={(item, i) => String(item.id ?? item.index_number ?? i)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <AppIcon name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {query.trim() ? 'No matches' : 'No students yet'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {query.trim()
                ? 'Try a different search.'
                : 'When students are assigned to your class, they appear here.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors, spacing, radius) =>
  StyleSheet.create({
    safe: { flex: 1 },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    headerBlock: { paddingTop: spacing.md, marginBottom: spacing.sm },
    screenTitle: { fontSize: 26, fontWeight: '800', letterSpacing: 0.3 },
    screenSub: { fontSize: 14, marginTop: 4, marginBottom: spacing.md },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1.5,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    searchInput: { flex: 1, fontSize: 15, padding: 0 },
    countLine: { fontSize: 12, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, minHeight: 280 },
    hint: { marginTop: spacing.md, fontSize: 14 },
    errorTitle: { fontSize: 18, fontWeight: '700', marginTop: spacing.md },
    errorBody: { fontSize: 14, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
    retryBtn: { marginTop: spacing.lg, paddingVertical: 14, paddingHorizontal: 28, borderRadius: radius.md },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 16, fontWeight: '800' },
    cardMain: { flex: 1, minWidth: 0 },
    name: { fontSize: 16, fontWeight: '700' },
    index: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: spacing.sm },
    meta: { fontSize: 12, flexShrink: 1 },
    badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    contact: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, gap: 6 },
    contactLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    contactText: { fontSize: 13, flex: 1 },
    emptyBox: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
    emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: spacing.md },
    emptySub: { fontSize: 14, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  });
