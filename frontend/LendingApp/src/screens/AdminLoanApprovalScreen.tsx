// src/screens/AdminLoanApprovalScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";

// ✅ ADDED — new header component (back arrow + blue bar)
import SmallHeader from "../components/SmallHeader";

type LoanRow = {
  id: string;
  user_id: string;
  full_name?: string;
  amount_requested: number;
  purpose: string;
  repayment_term_months: number;
  status: string;
  created_at: string;
};

export default function AdminLoanApprovalScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [processing, setProcessing] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadLoans();
  }, []);

  // ============================================================
  // 📌 LOAD PENDING LOANS
  // ============================================================
  const loadLoans = async () => {
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem("userToken");

      const res = await axios.get(
        "http://192.168.1.222:5001/api/admin/loan-approvals",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setLoans(res.data || []);
    } catch (err) {
      console.error("Load pending loans error:", err);
      Alert.alert("Error", "Failed to load pending loans.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // 📌 APPROVE LOAN
  // ============================================================
  const approveLoan = async (loanId: string) => {
    Alert.alert("Confirm", "Approve this loan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            setProcessing((p) => ({ ...p, [loanId]: true }));

            const token = await AsyncStorage.getItem("userToken");

            await axios.post(
              `http://192.168.1.222:5001/api/admin/loan-approvals/${loanId}/approve`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );

            Alert.alert("Success", "Loan approved successfully.");
            loadLoans();
          } catch (err) {
            console.error("Approve error:", err);
            Alert.alert("Error", "Failed to approve loan");
          } finally {
            setProcessing((p) => ({ ...p, [loanId]: false }));
          }
        },
      },
    ]);
  };

  // ============================================================
  // 📌 REJECT LOAN
  // ============================================================
  const rejectLoan = async (loanId: string) => {
    Alert.alert("Reject Loan", "Are you sure you want to reject this loan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            setProcessing((p) => ({ ...p, [loanId]: true }));

            const token = await AsyncStorage.getItem("userToken");

            await axios.post(
              `http://192.168.1.222:5001/api/admin/loan-approvals/${loanId}/reject`,
              { note: "" },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            Alert.alert("Rejected", "Loan has been rejected.");

            setLoans((cur) => cur.filter((l) => l.id !== loanId));
          } catch (err) {
            console.error("Reject error:", err);
            Alert.alert("Error", "Failed to reject loan.");
          } finally {
            setProcessing((p) => ({ ...p, [loanId]: false }));
          }
        },
      },
    ]);
  };

  // ============================================================
  // 📌 Render Loan Card
  // ============================================================
  const renderLoan = ({ item }: { item: LoanRow }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.name}>{item.full_name || "Unknown borrower"}</Text>
        <Text style={styles.amount}>
          ₱ {Number(item.amount_requested).toLocaleString()}
        </Text>
      </View>

      <Text style={styles.purpose}>{item.purpose}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          Term: {item.repayment_term_months} months
        </Text>
        <Text style={styles.meta}>
          Applied: {format(new Date(item.created_at), "MMM d, yyyy")}
        </Text>
      </View>

      <View style={styles.actions}>
        {/* APPROVE */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#00C853" }]}
          onPress={() => approveLoan(item.id)}
          disabled={!!processing[item.id]}
        >
          {processing[item.id] ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Approve</Text>
          )}
        </TouchableOpacity>

        {/* REJECT */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#ff3b30" }]}
          onPress={() => rejectLoan(item.id)}
          disabled={!!processing[item.id]}
        >
          {processing[item.id] ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Reject</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ============================================================
  // 📌 Loading UI
  // ============================================================
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ============================================================
  // 📌 Empty State
  // ============================================================
  if (!loans.length) {
    return (
      <View style={styles.center}>
        {/* ✅ ADDED — header even on empty state */}
        <SmallHeader title="Loan Approval" />

        <Text style={{ color: "#666", marginTop: 20 }}>
          No pending loans.
        </Text>
      </View>
    );
  }

  // ============================================================
  // 📌 Main UI with Header (NEW)
  // ============================================================
  return (
    <View style={{ flex: 1 }}>
      {/* ✅ ADDED — new blue header with back arrow */}
      <SmallHeader title="Loan Approval" />

      <FlatList
        contentContainerStyle={{ padding: 12, paddingBottom: 48 }}
        data={loans}
        keyExtractor={(i) => i.id}
        renderItem={renderLoan}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
    elevation: 3,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontWeight: "700", fontSize: 16 },
  amount: { fontWeight: "800", fontSize: 16, color: "#0071b2" },
  purpose: { color: "#444", marginTop: 8, marginBottom: 6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  meta: { color: "#666", fontSize: 12 },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 6,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
