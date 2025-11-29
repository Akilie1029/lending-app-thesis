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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import SmallHeader from "../components/SmallHeader";
import api from "../services/api";

export default function AdminLoanApprovalScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<any[]>([]);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadLoans();
  }, []);

  // -------------------------------
  // FETCH PENDING LOAN APPLICATIONS
  // -------------------------------
  const loadLoans = async () => {
    try {
      setLoading(true);

      const res = await api.get("/admin/pending-loans");
      setLoans(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.log("❌ Pending loans load error:", err?.response?.data || err);
      Alert.alert("Error", "Unable to load pending loan applications.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // REJECT LOAN
  // -------------------------------
  const rejectLoan = (loanId: string) => {
    Alert.alert(
      "Reject Loan",
      "Are you sure you want to reject this application?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessing((p) => ({ ...p, [loanId]: true }));
              await api.post(`/admin/loan/${loanId}/reject`, { note: "" });

              setLoans((prev) => prev.filter((l) => l.id !== loanId));
              Alert.alert("Rejected", "Loan application has been rejected.");
            } catch (err: any) {
              console.log("❌ Reject error:", err?.response?.data || err);
              Alert.alert("Error", "Failed to reject loan.");
            } finally {
              setProcessing((p) => ({ ...p, [loanId]: false }));
            }
          },
        },
      ]
    );
  };

  // -------------------------------
  // RENDER EACH LOAN
  // -------------------------------
  const renderLoan = ({ item }: { item: any }) => {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.name}>{item.full_name || "Borrower"}</Text>

          <Text style={styles.amount}>
            ₱ {Number(item.amount_requested ?? 0).toLocaleString()}
          </Text>
        </View>

        <Text style={styles.purpose}>{item.purpose}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>Term: {item.days ?? 0} days</Text>
          <Text style={styles.meta}>
            Applied:{" "}
            {item.created_at
              ? format(new Date(item.created_at), "MMM d, yyyy")
              : "—"}
          </Text>
        </View>

        <View style={styles.actions}>
          {/* NEW: Go to Loan Review Screen */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#1E90FF" }]}
            onPress={() =>
              navigation.navigate("AdminLoanReviewScreen", {
                loanId: item.id,
              })
            }
          >
            <Text style={styles.buttonText}>Review</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#ff3b30" }]}
            disabled={processing[item.id]}
            onPress={() => rejectLoan(item.id)}
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
  };

  // -------------------------------
  // RENDER MAIN SCREEN
  // -------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <SmallHeader title="Loan Approval" />
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  if (loans.length === 0) {
    return (
      <View style={styles.center}>
        <SmallHeader title="Loan Approval" />
        <Text style={{ color: "#666", marginTop: 20 }}>
          No pending loans at this time.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SmallHeader title="Loan Approval" />

      <FlatList
        data={loans}
        renderItem={renderLoan}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    elevation: 2,
    marginVertical: 8,
    borderWidth: 1.5,
    borderColor: "#e0f0ff",
  },

  row: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontSize: 16, fontWeight: "700" },
  amount: { fontSize: 17, fontWeight: "800", color: "#0071b2" },

  purpose: { marginTop: 6, color: "#444" },

  metaRow: {
    flexDirection: "row",
    marginTop: 6,
    justifyContent: "space-between",
  },
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
