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

export default function LoanDetailsScreen({ route, navigation }: any) {
  const { loan } = route.params;

  const principal = Number(loan.principal ?? 0);
  const interestRate = 0.20; // 20%
  const months = loan.days ? Math.ceil(loan.days / 30) : 1;

  const interestAmount = principal * interestRate * months;
  const totalRepay = principal + interestAmount;
  const monthlyPayment = totalRepay / months;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Loan Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ----------- LOAN SUMMARY CARD ----------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loan Summary</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Loan Amount:</Text>
            <Text style={styles.value}>₱ {principal.toLocaleString()}.00</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Interest Rate:</Text>
            <Text style={styles.value}>20% (per month)</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Interest Amount:</Text>
            <Text style={styles.value}>
              ₱ {interestAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Repayment Term:</Text>
            <Text style={styles.value}>{months} {months > 1 ? "months" : "month"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Purpose:</Text>
            <Text style={styles.value}>{loan.purpose || "—"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Date Submitted:</Text>
            <Text style={styles.value}>
              {loan.created_at
                ? new Date(loan.created_at).toLocaleDateString()
                : "—"}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>

            <Text
              style={[
                styles.value,
                {
                  color:
                    loan.status === "active"
                      ? "#0A9EFA"
                      : loan.status === "pending"
                      ? "#F5A623"
                      : "#28A745",
                  fontWeight: "700",
                },
              ]}
            >
              {loan.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* ----------- REPAYMENT BREAKDOWN CARD ----------- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Repayment Breakdown</Text>

          <Text style={styles.description}>
            Interest is applied at 20% per month. The interest shown is
            calculated as:
          </Text>
          <Text style={styles.descriptionFormula}>
            Interest = Principal × Monthly Rate × Number of Months
          </Text>

          <View style={[styles.row, { marginTop: 10 }]}>
            <Text style={styles.label}>Total Amount to Repay:</Text>
            <Text style={styles.value}>
              ₱ {totalRepay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Monthly Payment:</Text>
            <Text style={styles.value}>
              ₱ {monthlyPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ----------------------- STYLES ----------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f7fb",
  },

  header: {
    width: "100%",
    backgroundColor: "#169AF9",
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    elevation: 4,
  },

  backBtn: {
    marginRight: 10,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 16,
    padding: 16,
    borderWidth: 3,
    borderColor: "#169AF9",
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  label: {
    fontSize: 15,
    color: "#444",
    fontWeight: "600",
  },

  value: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },

  description: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },

  descriptionFormula: {
    fontSize: 13,
    color: "#777",
    marginBottom: 10,
  },
});

