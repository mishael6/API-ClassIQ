import { CommonActions } from '@react-navigation/native';
import { Platform, Alert } from 'react-native';
import axios from 'axios';
import { BASE_URL } from '../api/auth';
import { authStore } from '../store/authStore';
import { unsubscribeFromPush } from './pushNotifications';

/** Walk up to the root stack navigator */
export function getRootNavigation(navigation) {
  let root = navigation;
  while (root?.getParent?.()) {
    root = root.getParent();
  }
  return root;
}

export async function performLogout(navigation) {
  const token = await authStore.getToken().catch(() => null);

  if (token) {
    try {
      await axios.post(
        `${BASE_URL}/auth/logout.php`,
        {},
        { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 }
      );
    } catch {
      // Still clear local session if server call fails
    }
  }

  if (Platform.OS === 'web') {
    try {
      await unsubscribeFromPush();
    } catch {
      /* ignore */
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('classiq_push_enabled');
      localStorage.removeItem('classiq_vapid_public');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('classiq_sw_reloaded');
    }
  }

  await authStore.clear();

  if (Platform.OS === 'web') {
    window.location.replace('/');
    return;
  }

  const root = getRootNavigation(navigation);
  root.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: 'Landing' }],
    })
  );
}

export function confirmLogout(navigation) {
  const run = () => {
    performLogout(navigation).catch(() => {
      if (Platform.OS === 'web') {
        window.alert('Could not log out. Please try again.');
      } else {
        Alert.alert('Error', 'Could not log out. Please try again.');
      }
    });
  };

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm('Are you sure you want to log out?')) {
      run();
    }
    return;
  }

  Alert.alert('Log out', 'Are you sure you want to log out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: run },
  ]);
}
