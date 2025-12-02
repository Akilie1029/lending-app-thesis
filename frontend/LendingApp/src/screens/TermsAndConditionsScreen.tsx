// src/screens/TermsAndConditionsScreen.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function TermsAndConditionsScreen({ navigation }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 44 }}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Terms & Conditions</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.title}>Terms & Conditions (Placeholder)</Text>

          <Text style={styles.paragraph}>
            This is a placeholder for the Terms & Conditions. Replace this with the full legal text when available.
          </Text>

          <Text style={styles.paragraph}>
            For the demo, the key points are:
          </Text>

          <Text style={styles.bullet}>• Late fees apply after 2 consecutive missed payments.</Text>
          <Text style={styles.bullet}>• Always verify payout details before disbursement.</Text>
          <Text style={styles.bullet}>• This app is a thesis project — terms are illustrative only.</Text>

          <View style={{ height: 30 }} />

          <Text style={{ color: "#666" }}>
            When you have the legal copy, paste it here or load from a markdown/html resource and render accordingly.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 16,
    backgroundColor: "#169AF9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  paragraph: { color: "#444", marginBottom: 8 },
  bullet: { marginTop: 6, color: "#444" },
});
