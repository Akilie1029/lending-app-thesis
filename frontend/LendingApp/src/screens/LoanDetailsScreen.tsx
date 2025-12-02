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

  const principal = Number(loan.principal ?? 0);
  const days = Number(loan.days ?? 0);
  const daily = Number(loan.daily_payment ?? 0);
  const total = Number(loan.total_payable ?? 0);
  const remaining = Number(loan.remaining_balance ?? total);

  const INTEREST_RATE = loan.interest_rate
    ? Number(loan.interest_rate)
    : 0.2; // fallback = 20%

  const interestAmount =
    Number(loan.interest ?? principal * INTEREST_RATE) ||
    principal * INTEREST_RATE;

  const interestRateLabel = `${Math.round(INTEREST_RATE * 100)}%`;

  const createdAt = loan.created_at
    ? new Date(loan.created_at).toLocaleDateString()
    : "-";

  const statusRaw = (loan.status || "").toLowerCase();
  let statusLabel = (loan.status || "UNKNOWN").toUpperCase();

  const isPending = statusRaw === "pending";
  const isApproved = statusRaw === "approved";
  const isActive = statusRaw === "active";
  const isCompleted = statusRaw === "paid" || statusRaw === "completed";

  if (isApproved) statusLabel = "APPROVED (Pending Disbursement)";
  if (isPending) statusLabel = "PENDING";
  if (isActive) statusLabel = "ACTIVE";

  const purpose = loan.purpose || "-";
  const termLabel = `${days} days`;

  const showPayButton = isActive && !isCompleted;

  const money = (v: number) =>
    `₱ ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 44 }}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Loan Details</Text>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* SUMMARY CARD */}
        <View style={styles.card}>
          <Text style={styles.title}>Loan Summary</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Loan Amount</Text>
            <Text style={styles.value}>{money(principal)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Interest Rate</Text>
            <Text style={styles.value}>{interestRateLabel}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Interest Amount</Text>
            <Text style={[styles.value, { color: "#0077C8" }]}>
              {money(interestAmount)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Repayment Term</Text>
            <Text style={styles.value}>{termLabel}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Daily Payment</Text>
            <Text style={styles.value}>{money(daily)}</Text>
          </View>

          {/* ⭐ ALWAYS SHOW TOTAL PAYABLE */}
          <View style={styles.row}>
            <Text style={styles.label}>Total Payable</Text>
            <Text style={[styles.value, { color: "#0077C8" }]}>
              {money(total)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Purpose</Text>
            <Text style={styles.value}>{purpose}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Date Submitted</Text>
            <Text style={styles.value}>{createdAt}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text
              style={[
                styles.value,
                isActive
                  ? styles.statusActive
                  : isApproved
                  ? styles.statusApproved
                  : styles.statusPending,
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* ACTIVE LOANS — EXTRA BREAKDOWN */}
        {isActive && (
          <View style={styles.card}>
            <Text style={styles.title}>Repayment Breakdown</Text>

            <View style={styles.row}>
              <Text style={styles.label}>Total Amount to Repay</Text>
              <Text style={[styles.value, { color: "#0077C8" }]}>
                {money(total)}
              </Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Remaining Balance</Text>
              <Text style={[styles.value, { color: "#D62828" }]}>
                {money(remaining)}
              </Text>
            </View>
          </View>
        )}

        {/* IMPORTANT REMINDER */}
        <View style={styles.card}>
          <Text style={styles.title}>Important</Text>
          <Text style={styles.reminder}>
            <Text style={{ fontStyle: "italic" }}>
              Late fees will apply if no payment is made for 2 consecutive days.
            </Text>
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate("TermsAndConditions")}
            style={{ marginTop: 6 }}
          >
            <Text style={styles.termsText}>Terms & Conditions</Text>
          </TouchableOpacity>
        </View>

        {/* PAYMENT BUTTON (ACTIVE LOANS ONLY) */}
        {showPayButton && (
          <TouchableOpacity
            style={styles.payBtn}
            onPress={() => navigation.navigate("RepayLoan", { loan })}
          >
            <Text style={styles.payBtnText}>Make a Payment</Text>
          </TouchableOpacity>
        )}

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
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },

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

  divider: { height: 1, backgroundColor: "#eee", marginVertical: 12 },

  reminder: { color: "#444" },
  termsText: { color: "#169AF9", fontWeight: "700" },

  payBtn: {
    backgroundColor: "#169AF9",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
  },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  statusPending: { color: "#d67f00" },
  statusApproved: { color: "#d67f00" },
  statusActive: { color: "#19d06b" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
