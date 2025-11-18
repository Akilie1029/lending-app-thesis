import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MyLoanScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Loan</Text>
      <Text style={styles.subtitle}>Loan details will appear here.</Text>
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
