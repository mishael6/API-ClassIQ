import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeContext';
import { tabBarIcon } from '../components/AppIcon';

import DashboardScreen from '../screens/classrep/DashboardScreen';
import QRGeneratorScreen from '../screens/classrep/QRGeneratorScreen';
import AttendanceScreen from '../screens/classrep/AttendanceScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import ReportIssueScreen from '../screens/shared/ReportIssueScreen';

import StudentsScreen from '../screens/classrep/StudentsScreen';
import TriviaScreen from '../screens/classrep/TriviaScreen';
import AIStudyScreen from '../screens/student/AIStudyScreen';

const Tab = createBottomTabNavigator();

export default function ClassrepTabs({ route }) {
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
        name="Dashboard"
        component={DashboardScreen}
        initialParams={{ user }}
        options={{ tabBarIcon: tabBarIcon('bar-chart', 'bar-chart-outline'), tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="GenerateQR"
        component={QRGeneratorScreen}
        initialParams={{ user }}
        options={{ tabBarIcon: tabBarIcon('qr-code', 'qr-code-outline'), tabBarLabel: 'QR Code' }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        initialParams={{ user }}
        options={{ tabBarIcon: tabBarIcon('clipboard', 'clipboard-outline'), tabBarLabel: 'Attendance' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        initialParams={{ user }}
        options={{ tabBarIcon: tabBarIcon('settings', 'settings-outline'), tabBarLabel: 'Settings' }}
      />
      <Tab.Screen
        name="Students"
        component={StudentsScreen}
        initialParams={{ user }}
        options={{ tabBarButton: () => null, tabBarLabel: '' }}
      />
      <Tab.Screen
        name="AIStudy"
        component={AIStudyScreen}
        initialParams={{ user }}
        options={{ tabBarButton: () => null, tabBarLabel: '' }}
      />
      <Tab.Screen
        name="Trivia"
        component={TriviaScreen}
        initialParams={{ user }}
        options={{ tabBarButton: () => null, tabBarLabel: '' }}
      />
      <Tab.Screen
        name="ReportIssue"
        component={ReportIssueScreen}
        options={{ tabBarButton: () => null, tabBarLabel: '' }}
      />
    </Tab.Navigator>
  );
}
