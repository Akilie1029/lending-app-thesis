import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import { useRoute, useNavigation } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../config";

export default function LoanDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  // loan may be passed from previous screen to avoid refetch
  const passedLoan = route.params?.loan;
  const passedLoanId = route.params?.loanId;

  const [loan, setLoan] = useState<any>(passedLoan || null);
  const [loading, setLoading] = useState(!passedLoan);
  const [refreshing, setRefreshing] = useState(false);

  const id = passedLoan?.id ?? passedLoanId;

  useEffect(() => {
    if (!id || passedLoan) return;
    fetchLoan();
  }, [id]);

  const fetchLoan = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Not Authenticated", "Please login again.");
        setLoading(false);
        return;
      }

      const res = await axios.get(`${API_BASE}/loans/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setLoan(res.data);
    } catch (err: any) {
      console.error("Loan details error:", err?.response?.data || err?.message);
      Alert.alert("Error", "Unable to load loan details.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await fetchLoan();
    setRefreshing(false);
  };

  if (!loan && loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  if (!loan) {
    return (
      <View style={styles.center}>
        <Text>Loan not found.</Text>
      </View>
    );
  }

  // normalize fields (backwards-compatible)
  const principal = Number(loan.principal ?? loan.amount_requested ?? 0);
  const total = Number(loan.total_payable ?? 0);
  const remaining = Number(loan.remaining_balance ?? 0);
  const daily = Number(loan.daily_payment ?? loan.daily ?? 0);
  const status = (loan.status || "").toString().toLowerCase();

  const formattedDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString() : "—";

  const handleMakePayment = () => {
    // navigate to payment screen and pass loan object
    navigation.navigate("LoanPayMethod" as any, { loan });
  };

  const handleViewPayments = () => {
    navigation.navigate("Payment History" as any, { loanId: loan.id });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <LinearGradient
        colors={["#169AF9", "#37AAF2"]}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Loan Details</Text>

        <View style={{ width: 44 }} />
      </LinearGradient>

      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Principal</Text>
          <Text style={styles.value}>₱ {principal.toLocaleString()}</Text>

          <Text style={styles.label}>Total Payable</Text>
          <Text style={styles.value}>₱ {total.toLocaleString()}</Text>

          <Text style={styles.label}>Daily Payment</Text>
          <Text style={styles.value}>₱ {daily.toLocaleString()}</Text>

          <Text style={styles.label}>Remaining Balance</Text>
          <Text style={[styles.value, { color: "#D62828" }]}>
            ₱ {remaining.toLocaleString()}
          </Text>

          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{(loan.status || "—").toString().toUpperCase()}</Text>

          <Text style={styles.label}>Purpose</Text>
          <Text style={styles.small}>{loan.purpose || "—"}</Text>

          <Text style={styles.label}>Term</Text>
          <Text style={styles.small}>{loan.days ?? "—"} days</Text>

          <Text style={styles.label}>Applied At</Text>
          <Text style={styles.small}>{formattedDate(loan.created_at)}</Text>

          {loan.disbursed_at && (
            <>
              <Text style={styles.label}>Disbursed At</Text>
              <Text style={styles.small}>{formattedDate(loan.disbursed_at)}</Text>
            </>
          )}

          {loan.due_date && (
            <>
              <Text style={styles.label}>Next Due Date</Text>
              <Text style={styles.small}>{formattedDate(loan.due_date)}</Text>
            </>
          )}

          {loan.latest_due_date && loan.latest_due_date !== loan.due_date && (
            <>
              <Text style={styles.label}>Latest Due Date</Text>
              <Text style={styles.small}>{formattedDate(loan.latest_due_date)}</Text>
            </>
          )}
        </View>

        {/* Action buttons */}
        <View style={{ marginTop: 14 }}>
          {/* Show Make Payment only for active/approved */}
          {status === "active" || status === "approved" ? (
            <TouchableOpacity style={styles.payBtn} onPress={handleMakePayment}>
              <Text style={styles.payText}>Make a Payment</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: "#fff", borderWidth: 1, marginTop: 10 }]}
            onPress={handleViewPayments}
          >
            <Text style={{ color: "#169AF9", fontWeight: "700" }}>View Payment History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: "#eee", marginTop: 10 }]}
            onPress={refresh}
            disabled={refreshing}
          >
            <Text style={{ color: "#333", fontWeight: "700" }}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 20 },

  container: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    borderWidth: 2,
    borderColor: "#e8f4ff",
  },

  label: { color: "#666", marginTop: 12 },
  value: { fontSize: 22, fontWeight: "900", marginTop: 4 },
  small: { fontSize: 14, color: "#444", marginTop: 4 },

  payBtn: {
    backgroundColor: "#169AF9",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  payText: { color: "#fff", fontWeight: "800" },
});
