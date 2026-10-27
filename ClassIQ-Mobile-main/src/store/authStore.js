import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER: 'classiq_user',
  TOKEN: 'classiq_token',
};

export const authStore = {
  async saveUser(user, token) {
    if (user == null || token == null) {
      throw new Error('Cannot save session: missing user or token.');
    }
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
    await AsyncStorage.setItem(KEYS.TOKEN, token);
  },

  async getUser() {
    const raw = await AsyncStorage.getItem(KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  },

  async getToken() {
    return await AsyncStorage.getItem(KEYS.TOKEN);
  },

  async clear() {
    await AsyncStorage.removeItem(KEYS.USER);
    await AsyncStorage.removeItem(KEYS.TOKEN);
  },
};
