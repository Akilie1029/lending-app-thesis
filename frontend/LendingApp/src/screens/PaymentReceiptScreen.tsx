// src/screens/PaymentReceiptScreen.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function PaymentReceiptScreen({ navigation, route }: any) {
  const receipt = route.params?.receipt || {};
  const loan = route.params?.loan || {};
  const remaining =
    route.params?.remaining_balance ??
    loan?.remaining_balance ??
    0;

  console.log("🧾 PaymentReceiptScreen → receipt:", receipt);
  console.log("🧾 PaymentReceiptScreen → loan:", loan);

  const onDone = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Drawer" }], // borrower dashboard root
    });
  };

  const viewLoanDetails = () => {
    if (receipt.loan_id || loan.id) {
      navigation.reset({
        index: 0,
        routes: [{ name: "Drawer" }],
      });

      setTimeout(() => {
        navigation.navigate("My Loan");
        navigation.navigate("Loan Details", {
          loan: loan,
        });
      }, 300);
    } else {
      Alert.alert("Info", "Loan details not available.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 44 }}
        >
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Receipt</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Icon name="checkmark-circle" size={64} color="#19d06b" />
            <Text style={styles.successTitle}>Payment Successful</Text>
            <Text style={styles.txnId}>
              Transaction ID: {receipt.id ?? "—"}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Amount Paid</Text>
            <Text style={styles.value}>
              ₱ {Number(receipt.amount_paid ?? 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Method</Text>
            <Text style={styles.value}>
              {(receipt.payment_method || "N/A").toUpperCase()}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Paid At</Text>
            <Text style={styles.value}>
              {receipt.paid_at
                ? new Date(receipt.paid_at).toLocaleString()
                : receipt.created_at
                ? new Date(receipt.created_at).toLocaleString()
                : "—"}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Loan Remaining</Text>
            <Text
              style={[
                styles.value,
                { color: remaining <= 0 ? "#19d06b" : "#D62828" },
              ]}
            >
              ₱ {Number(remaining).toLocaleString()}
            </Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.noteText}>
              Loan ID: {receipt.loan_id ?? loan.id ?? "—"}
            </Text>
            <Text style={[styles.noteText, { marginTop: 6 }]}>
              If you need a copy of this receipt, take a screenshot.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.doneBtn} onPress={onDone}>
          <Text style={styles.doneText}>Back to Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.doneBtn,
            {
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#169AF9",
              marginTop: 8,
            },
          ]}
          onPress={viewLoanDetails}
        >
          <Text style={{ color: "#169AF9", fontWeight: "800" }}>
            View Loan Details
          </Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
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
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },

  successTitle: {
    fontWeight: "800",
    fontSize: 20,
    marginTop: 8,
  },
  txnId: {
    color: "#666",
    marginTop: 6,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  label: { color: "#666" },
  value: { fontWeight: "800" },

  noteText: { color: "#666" },

  doneBtn: {
    backgroundColor: "#169AF9",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
    marginHorizontal: 16,
  },
  doneText: { color: "#fff", fontWeight: "800" },
});
