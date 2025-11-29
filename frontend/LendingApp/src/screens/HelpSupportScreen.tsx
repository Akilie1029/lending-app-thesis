// src/screens/HelpSupportScreen.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function HelpSupportScreen({ navigation }: any) {
  const openEmail = () => {
    Linking.openURL("mailto:support@kaurta.app").catch(() =>
      Alert.alert("Error", "Unable to open email app.")
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.title}>Frequently Asked Questions</Text>

          <Text style={styles.question}>• How do I apply for a loan?</Text>
          <Text style={styles.answer}>
            Go to Loan Application in the menu, fill out the form, and submit required documents.
          </Text>

          <Text style={styles.question}>• How long is the approval time?</Text>
          <Text style={styles.answer}>Within 24 hours depending on admin review.</Text>

          <Text style={styles.question}>• How do I repay?</Text>
          <Text style={styles.answer}>
            You can repay daily through the Make a Payment button on the HomeScreen or My Loan.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Need More Help?</Text>

          <TouchableOpacity style={styles.linkBtn} onPress={openEmail}>
            <Icon name="mail" size={20} color="#169AF9" />
            <Text style={styles.linkText}>Email Support</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => Alert.alert("Chat Support", "This feature is not available in thesis mode.")}
          >
            <Icon name="chatbubble-ellipses" size={20} color="#169AF9" />
            <Text style={styles.linkText}>Chat Support</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },

  header: {
    backgroundColor: "#169AF9",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    marginVertical: 10,
    borderRadius: 12,
    elevation: 3,
  },
  title: { fontSize: 16, fontWeight: "800", marginBottom: 8 },

  question: { fontWeight: "700", marginTop: 10 },
  answer: { color: "#555", marginTop: 4 },

  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  linkText: {
    marginLeft: 10,
    color: "#169AF9",
    fontWeight: "700",
  },
});
