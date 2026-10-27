import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export default function LandingScreen({ navigation }) {
  const { colors, spacing, radius } = useTheme();
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: fadeAnim }]}>
      <Image
        source={require('../../../assets/user-verification.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.title, { color: colors.text }]}>Welcome to ClassIQ</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your study companion.</Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.btnText}>Get Started</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 10 },
  subtitle: { fontSize: 16, marginBottom: 40, textAlign: 'center' },
  btn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
