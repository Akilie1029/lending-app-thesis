// src/screens/LoanDetailsScreen.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

export default function LoanDetailsScreen({ navigation, route }: any) {
  const loan = route.params?.loan;

  console.log("📄 LoanDetailsScreen → loan payload:", loan);

  if (!loan) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#999" }}>No loan information provided.</Text>
      </View>
    );
  }

  // Canonical backend-safe fields
  const principal = Number(loan.principal || 0);
  const days = Number(loan.days || 0);
  const daily = Number(loan.daily_payment || 0);
  const total = Number(loan.total_payable || 0);
  const remaining = Number(loan.remaining_balance ?? total);

  const createdAt = loan.created_at
    ? new Date(loan.created_at).toLocaleDateString()
    : "-";

  const disbursedAt = loan.disbursed_at
    ? new Date(loan.disbursed_at).toLocaleDateString()
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 44 }}
        >
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Loan Details</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* SUMMARY CARD */}
        <View style={styles.card}>
          <Text style={styles.title}>Summary</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Principal</Text>
            <Text style={styles.value}>₱ {principal.toLocaleString()}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Term</Text>
            <Text style={styles.value}>{days} days</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Daily Payment</Text>
            <Text style={styles.value}>₱ {daily.toLocaleString()}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Total Payable</Text>
            <Text style={[styles.value, { color: "#0077C8" }]}>
              ₱ {total.toLocaleString()}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Remaining Balance</Text>
            <Text style={[styles.value, { color: "#D62828" }]}>
              ₱ {remaining.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* DATES CARD */}
        <View style={styles.card}>
          <Text style={styles.title}>Dates</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Date Applied</Text>
            <Text style={styles.value}>{createdAt}</Text>
          </View>

          {disbursedAt && (
            <View style={styles.row}>
              <Text style={styles.label}>Date Disbursed</Text>
              <Text style={styles.value}>{disbursedAt}</Text>
            </View>
          )}
        </View>

        {/* PAYMENT BUTTON */}
        <TouchableOpacity
          style={styles.payBtn}
          onPress={() => navigation.navigate("RepayLoan", { loan })}
        >
          <Text style={styles.payBtnText}>Make a Payment</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 2,
  },
  title: { fontSize: 17, fontWeight: "800", marginBottom: 10 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  label: { color: "#666" },
  value: { fontWeight: "800" },

  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 12,
  },

  payBtn: {
    backgroundColor: "#169AF9",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  payBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
