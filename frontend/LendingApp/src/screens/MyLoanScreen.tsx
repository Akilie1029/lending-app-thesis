// src/screens/MyLoanScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import LinearGradient from "react-native-linear-gradient";

const API_BASE = "http://192.168.1.222:5001/api";

export default function MyLoanScreen({ navigation }: any) {
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchLoan = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) return;

      const res = await axios.get(`${API_BASE}/loans/my-active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.id) setLoan(res.data);
      else setLoan(null);
    } catch (err) {
      console.log("MyLoanScreen error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoan();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  if (!loan) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noLoanTitle}>No Active Loan</Text>
        <Text style={styles.noLoanSubtitle}>You currently have no loan.</Text>

        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => navigation.navigate("Loan Application")}
        >
          <Text style={styles.applyBtnText}>Apply for Loan</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* HEADER */}
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <Text style={styles.headerTitle}>My Loan</Text>
        <Text style={styles.headerSubtitle}>Your loan and repayment details</Text>
      </LinearGradient>

      {/* LOAN SUMMARY */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Loan Summary</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Loan Amount:</Text>
          <Text style={styles.value}>₱ {loan.principal.toLocaleString()}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Interest (20%):</Text>
          <Text style={styles.value}>₱ {loan.interest.toLocaleString()}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Total Payable:</Text>
          <Text style={[styles.value, { color: "#0077C8" }]}>
            ₱ {loan.total_payable.toLocaleString()}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Daily Payment:</Text>
          <Text style={styles.value}>
            ₱ {loan.daily_payment.toLocaleString()}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Repayment Term:</Text>
          <Text style={styles.value}>{loan.days} days</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Remaining Days:</Text>
          <Text style={styles.value}>{loan.days_remaining} days</Text>
        </View>
      </View>

      {/* STATUS CARD */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Status</Text>

        <View
          style={[
            styles.statusChip,
            {
              backgroundColor:
                loan.status === "active"
                  ? "#00B050"
                  : loan.status === "pending"
                  ? "#F39C12"
                  : loan.status === "rejected"
                  ? "#FF3B30"
                  : "#999",
            },
          ]}
        >
          <Text style={styles.statusText}>{loan.status.toUpperCase()}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Remaining Balance:</Text>
          <Text style={[styles.value, { color: "#0077C8" }]}>
            ₱ {loan.remaining_balance.toLocaleString()}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Next Due Date:</Text>
          <Text style={styles.value}>
            {new Date(loan.latest_due_date).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Disbursed At:</Text>
          <Text style={styles.value}>
            {loan.disbursed_at
              ? new Date(loan.disbursed_at).toLocaleDateString()
              : "—"}
          </Text>
        </View>
      </View>

      {/* ACTION — SHOW ONLY WHEN ACTIVE */}
      {loan.status === "active" && (
        <TouchableOpacity
          style={styles.payBtn}
          onPress={() => navigation.navigate("RepayLoan", { loan })}
        >
          <Text style={styles.payBtnText}>Make a Payment</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

/* ===================== STYLES ====================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f9fc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: "#fff", fontSize: 28, fontWeight: "700" },
  headerSubtitle: { color: "#eaf8ff", fontSize: 14, marginTop: 4 },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#169AF9",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    color: "#000",
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 4 },
  label: { fontSize: 15, color: "#444" },
  value: { fontSize: 15, fontWeight: "700", color: "#000" },

  statusChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  statusText: { color: "#fff", fontWeight: "700" },

  payBtn: {
    backgroundColor: "#0077C8",
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  noLoanTitle: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  noLoanSubtitle: { fontSize: 15, color: "#777", marginBottom: 20 },
  applyBtn: {
    backgroundColor: "#169AF9",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  applyBtnText: { color: "#fff", fontWeight: "700" },
});
