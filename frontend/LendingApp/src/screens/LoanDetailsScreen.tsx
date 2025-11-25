import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useRoute, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";

const LoanDetailsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { loan } = route.params || {};

  if (!loan) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: "#777", fontSize: 16 }}>No loan details available</Text>
      </View>
    );
  }

  /** ================================
   *  NORMALIZATION — supports ALL formats
   * ================================ */

  const principal =
    Number(loan.principal) ||
    Number(loan.amount_requested) ||
    Number(loan.disbursed_amount) ||
    0;

  const interest =
    Number(loan.interest) ||
    Number(principal * 0.2) ||
    0;

  const total_payable =
    Number(loan.total_payable) ||
    Number(principal + interest) ||
    0;

  const days =
    Number(loan.days) ||
    Number(loan.repayment_days) ||
    30;

  const daily_payment =
    Number(loan.daily_payment) ||
    Number(total_payable / days) ||
    0;

  const total_repaid =
    Number(loan.total_repaid) ||
    0;

  const remaining_balance =
    Number(loan.remaining_balance) ||
    Number(total_payable - total_repaid);

  const late_fees_total =
    Number(loan.late_fees_total) || 0;

  const days_remaining =
    Number(loan.days_remaining) ||
    Math.max(0, days - Math.floor(total_repaid / daily_payment));

  const submittedDate =
    loan.created_at ? new Date(loan.created_at) : null;

  const approvedDate =
    loan.disbursed_at ? new Date(loan.disbursed_at) : null;

  const nextDue =
    loan.latest_due_date ? new Date(loan.latest_due_date) : null;

  const purpose = loan.purpose || "N/A";

  const formatMoney = (v: number) =>
    Number(v).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  /** ================================ */

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* HEADER */}
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Details</Text>
      </LinearGradient>

      {/* === LOAN SUMMARY === */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Loan Summary</Text>

        <DetailRow label="Loan Amount:" value={`₱ ${formatMoney(principal)}`} />
        <DetailRow label="Interest Amount:" value={`₱ ${formatMoney(interest)}`} />
        <DetailRow
          label="Total Payable:"
          value={`₱ ${formatMoney(total_payable)}`}
          valueColor="#0077C8"
        />

        <DetailRow label="Purpose:" value={purpose} />

        <DetailRow
          label="Date Submitted:"
          value={submittedDate ? submittedDate.toLocaleDateString() : "N/A"}
        />

        <DetailRow
          label="Date Approved:"
          value={approvedDate ? approvedDate.toLocaleDateString() : "N/A"}
        />

        <DetailRow
          label="Status:"
          value={String(loan.status).toUpperCase()}
          valueColor={
            loan.status === "approved"
              ? "#00B050"
              : loan.status === "pending"
              ? "#F39C12"
              : loan.status === "active"
              ? "#169AF9"
              : "#FF3B30"
          }
        />
      </View>

      {/* === REPAYMENT BREAKDOWN === */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Repayment Breakdown</Text>

        <DetailRow
          label="Daily Payment:"
          value={`₱ ${formatMoney(daily_payment)}`}
          valueColor="#0077C8"
        />

        <DetailRow label="Repayment Term:" value={`${days} days`} />
        <DetailRow label="Days Remaining:" value={days_remaining} />
        <DetailRow label="Days Completed:" value={days - days_remaining} />

        <DetailRow
          label="Total Paid:"
          value={`₱ ${formatMoney(total_repaid)}`}
        />

        <DetailRow
          label="Remaining Balance:"
          value={`₱ ${formatMoney(remaining_balance)}`}
          valueColor="#0077C8"
        />

        <DetailRow label="Late Fees:" value={`₱ ${formatMoney(late_fees_total)}`} />

        <DetailRow
          label="Next Due Date:"
          value={nextDue ? nextDue.toLocaleDateString() : "N/A"}
        />
      </View>
    </ScrollView>
  );
};

export default LoanDetailsScreen;

const DetailRow = ({
  label,
  value,
  valueColor = "#000",
}: {
  label: string;
  value: any;
  valueColor?: string;
}) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 20,
  },
  backButton: { marginRight: 10 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 15,
    elevation: 4,
    borderWidth: 2,
    borderColor: "#169AF9",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 5,
  },
  label: { fontSize: 15, color: "#555" },
  value: { fontSize: 15, fontWeight: "700" },
});
