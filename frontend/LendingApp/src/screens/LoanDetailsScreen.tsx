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

  // helper formatting
  const formatMoney = (v: number) =>
    Number(v).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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

        <DetailRow label="Loan Amount:" value={`₱ ${formatMoney(loan.principal)}`} />
        <DetailRow label="Interest Amount:" value={`₱ ${formatMoney(loan.interest)}`} />
        <DetailRow
          label="Total Payable:"
          value={`₱ ${formatMoney(loan.total_payable)}`}
          valueColor="#0077C8"
        />
        <DetailRow label="Purpose:" value={loan.purpose || "N/A"} />
        <DetailRow
          label="Date Submitted:"
          value={new Date(loan.created_at).toLocaleDateString()}
        />
        <DetailRow
          label="Date Approved:"
          value={loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : "N/A"}
        />
        <DetailRow
          label="Status:"
          value={String(loan.status).toUpperCase()}
          valueColor={
            loan.status === "approved"
              ? "#00B050"
              : loan.status === "pending"
              ? "#F39C12"
              : "#FF3B30"
          }
        />
      </View>

      {/* === REPAYMENT BREAKDOWN === */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Repayment Breakdown</Text>

        <DetailRow
          label="Daily Payment:"
          value={`₱ ${formatMoney(loan.daily_payment)}`}
          valueColor="#0077C8"
        />
        <DetailRow label="Repayment Term:" value={`${loan.days} days`} />
        <DetailRow label="Days Remaining:" value={loan.days_remaining} />
        <DetailRow label="Days Completed:" value={loan.days - loan.days_remaining} />

        <DetailRow
          label="Total Paid:"
          value={`₱ ${formatMoney(loan.total_repaid || 0)}`}
        />

        <DetailRow
          label="Remaining Balance:"
          value={`₱ ${formatMoney(loan.remaining_balance)}`}
          valueColor="#0077C8"
        />

        <DetailRow
          label="Late Fees:"
          value={`₱ ${formatMoney(loan.late_fees_total)}`}
        />

        <DetailRow
          label="Next Due Date:"
          value={
            loan.latest_due_date
              ? new Date(loan.latest_due_date).toLocaleDateString()
              : "N/A"
          }
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
    color: "#000",
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
