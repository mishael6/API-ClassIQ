import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { AppIcon } from '../../components/AppIcon';

const Placeholder = ({ title, iconName }) => (
  <SafeAreaView style={styles.safe}>
    <View style={styles.center}>
      <AppIcon name={iconName} size={56} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>This screen is coming soon.</Text>
    </View>
  </SafeAreaView>
);

export const StudentsScreen = () => <Placeholder title="Students" iconName="people-outline" />;
export const AttendanceScreen = () => <Placeholder title="Attendance" iconName="checkmark-circle-outline" />;
export const TriviaScreen = () => <Placeholder title="Trivia" iconName="trophy-outline" />;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { ...typography.h2, marginBottom: spacing.sm },
  sub: { ...typography.small },
});
