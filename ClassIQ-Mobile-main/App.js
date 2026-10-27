if (global.ErrorUtils?.setGlobalHandler) {
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('GLOBAL ERROR:', error?.message);
    console.log('STACK:', error?.stack);
  });
}

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import ErrorBoundary from './src/components/ErrorBoundary';

import LandingScreen from './src/screens/auth/LandingScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import StudentTabs from './src/navigation/StudentTabs';
import ClassrepTabs from './src/navigation/ClassrepTabs';
import { authStore } from './src/store/authStore';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import SignupScreen from './src/screens/auth/SignupScreen';
import SubscriptionScreen from './src/screens/student/SubscriptionScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import { Platform } from 'react-native';
import { initPushOnLogin, registerServiceWorker, setupPushForegroundHandler } from './src/utils/pushNotifications';

const Stack = createStackNavigator();

function AppNavigator() {
  const { colors } = useTheme();
  const [initialRoute, setInitialRoute] = useState(null);
  const [initialParams, setInitialParams] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          setupPushForegroundHandler();
          // Never block app launch on service worker — stale SW caused blank screens after deploy
          Promise.race([
            registerServiceWorker().catch((err) => console.warn('SW setup skipped:', err?.message)),
            new Promise((resolve) => setTimeout(resolve, 4000)),
          ]);
        }

        const user = await Promise.race([
          authStore.getUser(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);
        if (user) {
          setInitialRoute(user.role === 'classrep' ? 'ClassrepHome' : 'StudentHome');
          setInitialParams({ user });
          if (Platform.OS === 'web') initPushOnLogin();
        } else {
          setInitialRoute('Landing');
        }
      } catch (e) {
        setInitialRoute('Landing');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, animationEnabled: true }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="StudentHome" component={StudentTabs} initialParams={initialParams} />
        <Stack.Screen name="ClassrepHome" component={ClassrepTabs} initialParams={initialParams} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}