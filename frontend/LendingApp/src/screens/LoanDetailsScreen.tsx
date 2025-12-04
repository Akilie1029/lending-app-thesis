// src/screens/LoanDetailsScreen.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import api from "../services/api";

const LOG_PREFIX = "[LOAN_DETAILS]";

export default function LoanDetailsScreen({ navigation, route }: any) {
  const loan = route.params?.loan;

  const [processing, setProcessing] = useState(false);

  console.log(LOG_PREFIX, "📄 LoanDetailsScreen → loan payload:", loan);

  if (!loan) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#999" }}>No loan information provided.</Text>
      </View>
    );
  }

  // ------------------------------
  // VALUES
  // ------------------------------
  const principal = Number(loan.principal ?? 0);
  const approvedPrincipal = Number(loan.approved_principal ?? principal);

  const days = Number(loan.days ?? 0);

  const daily = Number(loan.approved_daily_payment ?? loan.daily_payment ?? 0);
  const total = Number(loan.approved_total_payable ?? loan.total_payable ?? 0);

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

  const isPending = statusRaw === "pending";
  const isApprovedPending = statusRaw === "approved_pending_disburse";
  const isApproved = statusRaw === "approved";
  const isActive = statusRaw === "active";
  const isCompleted = statusRaw === "paid" || statusRaw === "completed";

  let statusLabel = (loan.status || "UNKNOWN").toUpperCase();
  if (isApprovedPending) statusLabel = "AWAITING YOUR APPROVAL";
  if (isApproved) statusLabel = "APPROVED (Pending Disbursement)";
  if (isPending) statusLabel = "PENDING";
  if (isActive) statusLabel = "ACTIVE";

  const purpose = loan.purpose || "-";
  const termLabel = `${days} days`;

  const showPayButton = isActive && !isCompleted;

  const money = (v: number) =>
    `₱ ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  // -------------------------------------------------------------
  // BORROWER ACCEPT LOAN
  // -------------------------------------------------------------
  const handleAcceptLoan = () => {
    Alert.alert(
      "Confirm Loan Acceptance",
      `You are accepting the following loan:

• Principal: ${money(approvedPrincipal)}
• Total Payable: ${money(total)}
• Daily Payment: ${money(daily)}

Proceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept Loan",
          onPress: async () => {
            try {
              setProcessing(true);
              console.log(LOG_PREFIX, "➡️ Sending ACCEPT request:", loan.id);

              const res = await api.post(`/loans/${loan.id}/accept`);

              console.log(LOG_PREFIX, "ACCEPT Response:", res.data);

              Alert.alert("Success", "You have accepted the loan.", [
                {
                  text: "OK",
                  onPress: () => navigation.navigate("My Loan"),
                },
              ]);
            } catch (err: any) {
              console.log(
                LOG_PREFIX,
                "❌ Accept loan error:",
                err?.response?.data || err?.message
              );
              Alert.alert(
                "Error",
                err?.response?.data?.message ||
                  "Unable to accept loan at this time."
              );
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------
  // BORROWER REJECT LOAN
  // -------------------------------------------------------------
  const handleRejectLoan = () => {
    Alert.alert(
      "Reject Loan?",
      "Are you sure you want to reject this approved loan offer?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessing(true);
              console.log(LOG_PREFIX, "➡️ Sending REJECT request:", loan.id);

              const res = await api.post(`/loans/${loan.id}/reject`);

              console.log(LOG_PREFIX, "REJECT Response:", res.data);

              Alert.alert("Loan Rejected", "You have declined the loan offer.", [
                {
                  text: "OK",
                  onPress: () => navigation.navigate("My Loan"),
                },
              ]);
            } catch (err: any) {
              console.log(
                LOG_PREFIX,
                "❌ Reject loan error:",
                err?.response?.data || err?.message
              );
              Alert.alert(
                "Error",
                err?.response?.data?.message ||
                  "Unable to reject loan at this time."
              );
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------
  // UI
  // -------------------------------------------------------------
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

      {/* BODY */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        {/* SUMMARY CARD */}
        <View style={styles.card}>
          <Text style={styles.title}>Loan Summary</Text>

          <View style={styles.row}>
            <Text style={styles.label}>
              {isApprovedPending || isApproved ? "Approved Amount" : "Loan Amount"}
            </Text>
            <Text style={styles.value}>{money(approvedPrincipal)}</Text>
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

        {/* ACTIVE LOAN BREAKDOWN */}
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
                {money(loan.remaining_balance ?? total)}
              </Text>
            </View>
          </View>
        )}

        {/* IMPORTANT SECTION */}
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

        {/* PAYMENT BUTTON */}
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

      {/* -------------------------- */}
      {/* ACCEPT / REJECT BUTTONS    */}
      {/* -------------------------- */}
      {isApprovedPending && (
        <View style={styles.bottomActionContainer}>
          <TouchableOpacity
            style={[styles.bottomBtn, { backgroundColor: "#28a745" }]}
            disabled={processing}
            onPress={handleAcceptLoan}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.bottomBtnText}>Accept Loan</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomBtn, { backgroundColor: "#dc3545" }]}
            disabled={processing}
            onPress={handleRejectLoan}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.bottomBtnText}>Reject Loan</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// -------------------------------------------------------------
// STYLES
// -------------------------------------------------------------
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

  bottomActionContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 6,
  },
  bottomBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
