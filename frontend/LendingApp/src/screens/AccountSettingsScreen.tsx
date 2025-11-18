import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AccountSettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Settings</Text>
      <Text style={styles.subtitle}>Settings options will go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
  },
});
