import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crash:', error?.message, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.emoji}>😅</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.msg}>{this.state.error?.message || 'Unknown error'}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => {
            if (typeof window !== 'undefined') window.location.reload();
            else this.setState({ error: null });
          }}>
            <Text style={styles.btnText}>Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F5F7FA' },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#0D1B2A', marginBottom: 8 },
  msg: { fontSize: 14, color: '#4A5568', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn: { backgroundColor: '#1A73E8', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
