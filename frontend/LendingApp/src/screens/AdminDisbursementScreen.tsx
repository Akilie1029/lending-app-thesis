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

// ✅ ADDED — new header component (back arrow + blue bar)
import SmallHeader from "../components/SmallHeader";

type LoanRow = {
  id: string;
  user_id: string;
  full_name?: string;
  amount_requested: number;
  purpose: string;
  created_at: string;
};

export default function AdminDisbursementScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [processing, setProcessing] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadLoans();
  }, []);

  // ============================================================
  // 📌 LOAD PENDING DISBURSEMENTS
  // ============================================================
  const loadLoans = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");

      const res = await axios.get(
        "http://192.168.1.222:5001/api/admin/disbursements",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setLoans(res.data || []);
    } catch (err) {
      console.error("Error loading disbursements:", err);
      Alert.alert("Error", "Failed to load disbursement list.");
    }
    setLoading(false);
  };

  // ============================================================
  // 📌 DISBURSE LOAN
  // ============================================================
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
              `http://192.168.1.222:5001/api/admin/disburse/${loanId}`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );

            Alert.alert("Success", "Loan disbursed successfully!");

            // Remove from list (instantly updates UI)
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

  // ============================================================
  // 📌 RENDER LOAN CARD
  // ============================================================
  const renderLoan = ({ item }: { item: LoanRow }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.full_name || "Unknown Borrower"}</Text>

      <Text style={styles.amount}>
        ₱ {Number(item.amount_requested).toLocaleString()}
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

  // ============================================================
  // 📌 LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <View style={styles.center}>
        {/* ✅ ADDED — header even during loading */}
        <SmallHeader title="Disbursement" />
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      </View>
    );
  }

  // ============================================================
  // 📌 EMPTY STATE
  // ============================================================
  if (!loans.length) {
    return (
      <View style={styles.center}>
        {/* ✅ ADDED — header on empty state */}
        <SmallHeader title="Disbursement" />

        <Text style={{ color: "#666", marginTop: 20 }}>
          No loans awaiting disbursement.
        </Text>
      </View>
    );
  }

  // ============================================================
  // 📌 MAIN SCREEN WITH HEADER (NEW)
  // ============================================================
  return (
    <View style={{ flex: 1 }}>
      {/* ✅ ADDED — beautiful blue header with back arrow */}
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
    marginVertical: 8,
    padding: 12,
    borderRadius: 10,
    elevation: 3,
  },

  name: { fontSize: 16, fontWeight: "700" },

  amount: {
    fontSize: 16,
    color: "#007aff",
    fontWeight: "700",
    marginTop: 4,
  },

  purpose: { marginTop: 6, color: "#444" },

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
