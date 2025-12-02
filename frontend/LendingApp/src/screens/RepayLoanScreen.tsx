// src/screens/RepayLoanScreen.tsx
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE } from "../config";
import Icon from "react-native-vector-icons/Ionicons";

type Props = {
  navigation: any;
  route: { params: { loan: any } };
};

const PAYMENT_METHODS: Array<{ id: string; label: string }> = [
  { id: "gcash", label: "GCash" },
  { id: "maya", label: "Maya" },
  { id: "bank", label: "Bank Transfer" },
  { id: "card", label: "Card (Simulated)" },
];

export default function RepayLoanScreen({ navigation, route }: Props) {
  const loan = route.params?.loan;

  const principal = Number(loan?.principal ?? loan?.amount_requested ?? 0);
  const total = Number(loan?.total_payable ?? 0);
  const remaining = Number(loan?.remaining_balance ?? total);
  const daily = Number(loan?.daily_payment ?? 0);

  const [amountToPay, setAmountToPay] = useState<number>(
    Math.min(daily || total, remaining)
  );
  const [method, setMethod] = useState<string>("gcash");
  const [loading, setLoading] = useState(false);

  const friendlyRemaining = useMemo(() => remaining.toFixed(2), [remaining]);

  // Normalize method to backend accepted format
  const mapPaymentMethod = (m: string) => {
    if (m === "gcash") return "gcash";
    if (m === "maya") return "maya";
    if (m === "bank") return "bank_transfer";
    if (m === "card") return "card";
    return "gcash";
  };

  const payNow = async () => {
    if (!loan?.id) {
      Alert.alert("Error", "Loan data missing.");
      return;
    }

    if (!amountToPay || amountToPay <= 0) {
      Alert.alert("Invalid amount", "Enter a valid payment amount.");
      return;
    }

    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 900));

      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Not logged in", "Please login and try again.");
        setLoading(false);
        return;
      }

      const payload = {
        loan_id: loan.id,
        amount: amountToPay,
        payment_method: mapPaymentMethod(method),
      };

      console.log("📤 REPAYMENT REQUEST →", payload);

      const res = await axios.post(`${API_BASE}/repayments/pay`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("📥 REPAYMENT RESPONSE →", res.data);

      const payment = res.data?.payment;
      const updatedRemaining = res.data?.remaining_balance;
      const updatedLoan = res.data?.loan ?? loan;

      if (!payment) {
        Alert.alert(
          "Payment",
          "Server returned invalid payment object. Check Railway logs."
        );
        return;
      }

      navigation.replace("PaymentReceipt", {
        receipt: payment,
        remaining_balance: updatedRemaining,
        loan: updatedLoan,
      });
    } catch (err: any) {
      console.error("❌ Repayment error:", err?.response?.data || err?.message);

      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Payment failed. Please try again.";
      Alert.alert("Payment Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const quickSet = (type: "daily" | "full") => {
    if (type === "daily")
      setAmountToPay(Math.min(daily || total, remaining));
    else setAmountToPay(remaining);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Make a Payment</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loan</Text>
          <Text style={styles.bigAmount}>₱ {principal.toLocaleString()}</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Term</Text>
            <Text style={styles.value}>{loan?.days ?? "—"} days</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Daily Payment</Text>
            <Text style={styles.value}>₱ {daily.toLocaleString()}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Remaining</Text>
            <Text style={[styles.value, { color: "#D62828" }]}>
              ₱ {remaining.toLocaleString()}
            </Text>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={[styles.label, { marginBottom: 8 }]}>
              Amount to pay
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => quickSet("daily")}
              >
                <Text style={styles.quickBtnText}>Daily</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => quickSet("full")}
              >
                <Text style={styles.quickBtnText}>Full</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountBox}>
              <Text style={{ fontWeight: "800", fontSize: 20 }}>
                ₱ {Number(amountToPay).toLocaleString()}
              </Text>
              <Text style={{ color: "#666", fontSize: 12 }}>
                Will be charged to selected method
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Method</Text>

          {PAYMENT_METHODS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.methodRow,
                method === m.id ? styles.methodActive : undefined,
              ]}
              onPress={() => setMethod(m.id)}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Icon
                  name={
                    m.id === "gcash"
                      ? "wallet"
                      : m.id === "maya"
                      ? "card"
                      : m.id === "bank"
                      ? "business"
                      : "card"
                  }
                  size={20}
                  color={method === m.id ? "#fff" : "#169AF9"}
                />
                <Text
                  style={[
                    styles.methodLabel,
                    method === m.id ? { color: "#fff" } : undefined,
                  ]}
                >
                  {m.label}
                </Text>
              </View>

              {method === m.id && (
                <Text style={{ color: "#fff", fontWeight: "800" }}>Selected</Text>
              )}
            </TouchableOpacity>
          ))}

          <Text style={{ color: "#666", marginTop: 8 }}>
            Note: This app simulates payment. No real money is transferred.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.payBtn, loading ? { opacity: 0.7 } : null]}
          onPress={payNow}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payBtnText}>
              Pay ₱ {Number(amountToPay).toLocaleString()}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 16,
    backgroundColor: "#169AF9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: { width: 44 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  cardTitle: { fontWeight: "800", marginBottom: 8 },
  bigAmount: { fontSize: 22, fontWeight: "900", color: "#0077C8" },

  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  label: { color: "#666" },
  value: { fontWeight: "800" },

  quickBtn: {
    backgroundColor: "#f3f8fb",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  quickBtnText: { fontWeight: "700", color: "#0077C8" },

  amountBox: {
    backgroundColor: "#f3faff",
    padding: 12,
    borderRadius: 8,
    marginTop: 6,
  },

  methodRow: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e6f2fb",
    marginVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  methodActive: { backgroundColor: "#169AF9", borderColor: "#169AF9" },
  methodLabel: { marginLeft: 10, fontWeight: "700" },

  payBtn: {
    backgroundColor: "#169AF9",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  payBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
