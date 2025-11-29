// src/screens/PaymentReceiptScreen.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function PaymentReceiptScreen({ navigation, route }: any) {
  const receipt = route.params?.receipt || {};
  const loan = route.params?.loan || {};
  const remaining = route.params?.remaining_balance ?? loan?.remaining_balance ?? 0;

  // Basic checks
  if (!receipt || !receipt.transaction_id) {
    // Still render gracefully
    console.warn("PaymentReceiptScreen: missing receipt data", receipt);
  }

  const onDone = () => {
    // Navigate back to Home (or Loan details). Using reset to avoid back navigation oddities.
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 44 }}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receipt</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Icon name="checkmark-circle" size={64} color="#19d06b" />
            <Text style={{ fontWeight: "800", fontSize: 20, marginTop: 8 }}>Payment Successful</Text>
            <Text style={{ color: "#666", marginTop: 6 }}>Transaction ID: {receipt.transaction_id ?? "—"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Amount Paid</Text>
            <Text style={styles.value}>₱ {Number(receipt.amount_paid ?? 0).toLocaleString()}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Method</Text>
            <Text style={styles.value}>{(receipt.payment_method || "N/A").toUpperCase()}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Paid At</Text>
            <Text style={styles.value}>{receipt.paid_at ? new Date(receipt.paid_at).toLocaleString() : "—"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Loan Remaining</Text>
            <Text style={[styles.value, { color: remaining <= 0 ? "#19d06b" : "#D62828" }]}>₱ {Number(remaining).toLocaleString()}</Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: "#666" }}>Loan ID: {receipt.loan_id ?? loan.id ?? "—"}</Text>
            <Text style={{ color: "#666", marginTop: 6 }}>
              If you need a copy of this receipt, take a screenshot or export (not implemented).
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneText}>Back to Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: "#fff", borderWidth: 1, borderColor: "#169AF9", marginTop: 8 }]}
          onPress={() => {
            // Offer to view loan details if we have loan id
            if (receipt.loan_id || loan.id) {
              navigation.reset({ index: 0, routes: [{ name: "Home" }] });
              setTimeout(() => {
                // small delay then navigate to Loan Details via root nav (some setups use nested nav)
                navigation.navigate("My Loan");
                navigation.navigate("Loan Details", { loan: loan });
              }, 300);
            } else {
              Alert.alert("Info", "Loan details not available.");
            }
          }}
        >
          <Text style={{ color: "#169AF9", fontWeight: "800" }}>View Loan Details</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 50, paddingBottom: 18, paddingHorizontal: 16, backgroundColor: "#169AF9", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },

  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },

  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 8 },
  label: { color: "#666" },
  value: { fontWeight: "800" },

  doneBtn: { backgroundColor: "#169AF9", paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 6, marginHorizontal: 16 },
  doneText: { color: "#fff", fontWeight: "800" },
});
