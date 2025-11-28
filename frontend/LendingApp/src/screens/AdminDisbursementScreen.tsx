// src/screens/AdminDisbursementScreen.tsx
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

export default function AdminDisbursementScreen() {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [processing, setProcessing] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadLoans();
  }, []);

  // ------------------------------
  // load loans waiting disbursement
  // ------------------------------
  const loadLoans = async () => {
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem("userToken");

      const res = await axios.get(
        `${BASE_URL}/api/admin/disbursements`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const normalized = (res.data || []).map((r: any) => normalizeLoan(r));
      setLoans(normalized);
    } catch (err) {
      console.error("Error loading disbursements:", err);
      Alert.alert("Error", "Failed to load disbursement list.");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------
  // DISBURSE
  // ------------------------------
  const disburseLoan = async (loanId: string) => {
    Alert.alert("Confirm", "Disburse this loan now?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disburse",
        onPress: async () => {
          try {
            setProcessing((p) => ({ ...p, [loanId]: true }));

            const token = await AsyncStorage.getItem("userToken");

            await axios.post(
              `${BASE_URL}/api/admin/disburse/${loanId}`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );

            Alert.alert("Success", "Loan disbursed successfully!");
            setLoans((cur) => cur.filter((l) => l.id !== loanId));
          } catch (err) {
            console.error("Disbursement error:", err);
            Alert.alert("Error", "Failed to disburse loan.");
          } finally {
            setProcessing((p) => ({ ...p, [loanId]: false }));
          }
        },
      },
    ]);
  };

  const renderLoan = ({ item }: { item: LoanRow }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.full_name || "Unknown Borrower"}</Text>

      <Text style={styles.amount}>
        ₱ {Number(item.amount ?? item.amount_requested ?? 0).toLocaleString()}
      </Text>

      <Text style={styles.purpose}>Purpose: {item.purpose}</Text>

      <Text style={styles.date}>
        Approved: {format(new Date(item.created_at), "MMM d, yyyy")}
      </Text>

      <TouchableOpacity
        style={styles.disburseBtn}
        onPress={() => disburseLoan(item.id)}
        disabled={!!processing[item.id]}
      >
        {processing[item.id] ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Disburse</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // ------------------------------
  // RENDER
  // ------------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <SmallHeader title="Disbursement" />
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      </View>
    );
  }

  if (!loans.length) {
    return (
      <View style={styles.center}>
        <SmallHeader title="Disbursement" />
        <Text style={{ color: "#666", marginTop: 20 }}>
          No loans awaiting disbursement.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SmallHeader title="Disbursement" />

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
    borderRadius: 10,
    elevation: 3,
    marginVertical: 8,
  },

  name: { fontSize: 16, fontWeight: "700" },

  amount: {
    fontSize: 16,
    color: "#007aff",
    fontWeight: "700",
    marginTop: 6,
  },

  purpose: { color: "#444", marginTop: 4 },

  date: { color: "#777", marginTop: 4 },

  disburseBtn: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: "#00C853",
    borderRadius: 10,
    alignItems: "center",
  },

  btnText: { color: "#fff", fontWeight: "700" },
});
