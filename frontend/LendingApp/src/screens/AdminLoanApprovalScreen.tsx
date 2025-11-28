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
import SmallHeader from "../components/SmallHeader";
import { normalizeLoan } from "../utils/normalizeLoan";
import { BASE_URL } from "../config";

type LoanRow = {
  id: string;
  user_id: string;
  full_name?: string;
  amount_requested?: number | string;
  amount?: number | string;
  purpose: string;
  days?: number | null;
  status: string;
  created_at: string;
};

export default function AdminLoanApprovalScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [processing, setProcessing] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadLoans();
  }, []);

  // ------------------------------
  // Load all pending loans
  // ------------------------------
  const loadLoans = async () => {
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem("userToken");

      const res = await axios.get(
        `${BASE_URL}/api/admin/loan-approvals`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const normalized = (res.data || []).map((r: any) => normalizeLoan(r));
      setLoans(normalized || []);
    } catch (err) {
      console.error("Load pending loans error:", err);
      Alert.alert("Error", "Failed to load pending loans.");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // APPROVE
  // ------------------------------
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
              `${BASE_URL}/api/admin/loan-approvals/${loanId}/approve`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );

            Alert.alert("Success", "Loan approved successfully.");
            loadLoans();
          } catch (err) {
            console.error("Approve error:", err);
            Alert.alert("Error", "Failed to approve loan.");
          } finally {
            setProcessing((p) => ({ ...p, [loanId]: false }));
          }
        },
      },
    ]);
  };

  // ------------------------------
  // REJECT
  // ------------------------------
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
              `${BASE_URL}/api/admin/loan-approvals/${loanId}/reject`,
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

  const renderLoan = ({ item }: { item: LoanRow }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.name}>{item.full_name || "Unknown borrower"}</Text>
        <Text style={styles.amount}>
          ₱ {Number(item.amount ?? item.amount_requested ?? 0).toLocaleString()}
        </Text>
      </View>

      <Text style={styles.purpose}>{item.purpose}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>Term: {item.days ?? 0} days</Text>
        <Text style={styles.meta}>
          Applied: {format(new Date(item.created_at), "MMM d, yyyy")}
        </Text>
      </View>

      <View style={styles.actions}>
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

  // ------------------------------
  // RENDER
  // ------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <SmallHeader title="Loan Approval" />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!loans.length) {
    return (
      <View style={styles.center}>
        <SmallHeader title="Loan Approval" />
        <Text style={{ color: "#666", marginTop: 20 }}>No pending loans.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SmallHeader title="Loan Approval" />

      <FlatList
        contentContainerStyle={{ padding: 12 }}
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
    elevation: 3,
    marginVertical: 8,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontSize: 16, fontWeight: "700" },
  amount: { fontSize: 16, fontWeight: "800", color: "#0071b2" },
  purpose: { color: "#444", marginTop: 8 },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  meta: { fontSize: 12, color: "#666" },
  actions: { flexDirection: "row", marginTop: 12 },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 6,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
