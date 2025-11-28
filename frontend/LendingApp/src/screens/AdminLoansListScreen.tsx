// src/screens/AdminLoansListScreen.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function AdminLoansListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Loans List Screen 📄</Text>
      <Text style={styles.sub}>Connected to live backend</Text>
      <Text style={styles.sub}>Ready for expansion</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  sub: { fontSize: 14, color: "#666" },
});
