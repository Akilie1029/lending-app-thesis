import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";

export default function BankPayScreen({ route, navigation }: any) {
  const { loan, amount } = route.params;

  const [bank, setBank] = useState("");
  const [ref, setRef] = useState("");

  const handlePay = () => {
    if (!bank) return Alert.alert("Missing Bank", "Select a bank.");
    if (!ref) return Alert.alert("Missing Reference", "Enter a reference number.");

    Alert.alert("Payment Confirmed", "Bank transfer was simulated successfully.");
    navigation.popToTop();
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bank Transfer</Text>
        <View style={{ width: 26 }} />
      </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.label}>Amount to Pay</Text>
        <Text style={styles.amount}>₱ {amount.toLocaleString()}</Text>

        <Text style={[styles.label, { marginTop: 20 }]}>Choose Bank</Text>
        <TextInput
          placeholder="e.g. Landbank, BDO, BPI"
          value={bank}
          onChangeText={setBank}
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 20 }]}>Reference Number</Text>
        <TextInput
          placeholder="Transaction Reference"
          keyboardType="numeric"
          value={ref}
          onChangeText={setRef}
          style={styles.input}
        />

        <TouchableOpacity style={styles.button} onPress={handlePay}>
          <Text style={styles.buttonText}>Confirm Payment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },
  header: {
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  card: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: "#169AF9",
    borderRadius: 16,
  },
  label: { fontSize: 14, color: "#666" },
  amount: { fontSize: 32, fontWeight: "800" },
  input: {
    borderWidth: 1.3,
    borderColor: "#ccc",
    padding: 12,
    marginTop: 10,
    borderRadius: 10,
  },
  button: {
    marginTop: 25,
    backgroundColor: "#169AF9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
