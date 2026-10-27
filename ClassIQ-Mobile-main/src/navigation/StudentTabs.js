import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeContext';
import { tabBarIcon } from '../components/AppIcon';

import HomeScreen from '../screens/student/HomeScreen';
import ScannerScreen from '../screens/student/ScannerScreen';
import AIStudyScreen from '../screens/student/AIStudyScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import ReportIssueScreen from '../screens/shared/ReportIssueScreen';
import StudentTriviaScreen from '../screens/student/TriviaScreen';
import AttendanceScreen from '../screens/student/AttendanceScreen';

const Tab = createBottomTabNavigator();

export default function StudentTabs({ route }) {
  const { colors } = useTheme();
  const user = route?.params?.user;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        initialParams={{ user }}
        options={{ tabBarIcon: tabBarIcon('home', 'home-outline'), tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{ tabBarIcon: tabBarIcon('qr-code', 'qr-code-outline'), tabBarLabel: 'Scan QR' }}
      />
      <Tab.Screen
        name="AIStudy"
        component={AIStudyScreen}
        options={{ tabBarIcon: tabBarIcon('sparkles', 'sparkles-outline'), tabBarLabel: 'Six' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        initialParams={{ user }}
        options={{ tabBarIcon: tabBarIcon('settings', 'settings-outline'), tabBarLabel: 'Settings' }}
      />
      {/* Hidden screens accessible from HomeScreen */}
      <Tab.Screen
        name="Trivia"
        component={StudentTriviaScreen}
        options={{ tabBarButton: () => null, tabBarLabel: '' }}
      />
      <Tab.Screen
        name="ReportIssue"
        component={ReportIssueScreen}
        options={{ tabBarButton: () => null, tabBarLabel: '' }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        initialParams={{ user }}
        options={{ tabBarButton: () => null, tabBarLabel: '' }}
      />
    </Tab.Navigator>
  );
}
