import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRoute, useNavigation } from "@react-navigation/native";
import { API_BASE } from "../config";

/**
 * LoanPayMethodScreen
 *
 * - Expects `route.params.loan` (object). If not present, you can pass loanId and fetch loan (not implemented here).
 * - Calculates suggested payment amount: default to daily payment; allows paying remaining (if user wants).
 * - Simulates / performs payment by calling POST /api/repayments/pay (adjust endpoint to your backend).
 *
 * NOTE: adapt the POST body to match your backend's expected fields.
 */

export default function LoanPayMethodScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const loan = route.params?.loan;
  if (!loan) {
    // defensive fallback
    Alert.alert("Missing loan", "No loan passed to payment screen.");
    navigation.goBack();
    return null;
  }

  // values
  const principal = Number(loan.principal ?? loan.amount_requested ?? 0);
  const daily = Number(loan.daily_payment ?? loan.daily ?? 0);
  const remaining = Number(loan.remaining_balance ?? 0);

  // Payment amount defaults to daily, but user can choose remaining or custom
  const [amount, setAmount] = useState<number>(Math.min(daily || remaining || principal, remaining || principal));
  const [method, setMethod] = useState<"inapp" | "gcash" | "bank">("inapp");
  const [receiver, setReceiver] = useState<string>(""); // e.g., gcash number or bank acct
  const [loading, setLoading] = useState(false);

  const suggestedAmounts = useMemo(() => {
    const arr = [];
    if (daily) arr.push(Math.min(daily, remaining || principal));
    if (remaining && remaining > daily) arr.push(remaining);
    return arr;
  }, [daily, remaining, principal]);

  const formatPHP = (v: number) =>
    `₱ ${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const submitPayment = async () => {
    if (!amount || isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid payment amount.");
      return;
    }

    if (amount > (remaining || principal)) {
      Alert.alert("Amount exceeds remaining", "Payment cannot exceed remaining balance.");
      return;
    }

    // For external methods require receiver/account
    if ((method === "gcash" || method === "bank") && receiver.trim().length < 3) {
      Alert.alert("Missing details", "Enter the account number / reference for this payout method.");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Not logged in", "Please login again.");
        setLoading(false);
        return;
      }

      // POST body — adapt to your backend fields if needed
      const payload = {
        loan_id: loan.id,
        amount,
        payment_method: method === "inapp" ? "in_app" : method === "gcash" ? "gcash" : "bank_transfer",
        details: {
          receiver: receiver || null,
        },
      };

      const res = await axios.post(`${API_BASE}/repayments/pay`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // expect res.data.success or similar
      if (res.status >= 200 && res.status < 300) {
        Alert.alert("Payment Submitted", "Your payment was recorded.", [
          {
            text: "OK",
            onPress: () => {
              // go back to MyLoan or LoanDetails and refresh
              navigation.reset({
                index: 0,
                routes: [{ name: "Home" as any }], // you may prefer to go to MyLoan screen
              });
            },
          },
        ]);
      } else {
        console.warn("Payment response:", res.data);
        Alert.alert("Payment Error", res.data?.error || "Unexpected response from server.");
      }
    } catch (err: any) {
      console.error("Payment error:", err?.response?.data || err?.message);
      Alert.alert("Payment Failed", err?.response?.data?.error || err?.message || "Failed to submit payment.");
    } finally {
      setLoading(false);
    }
  };

  const quickSet = (val: number) => setAmount(Number(val));

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Repay Loan</Text>

        <View style={{ width: 44 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Loan</Text>
          <Text style={styles.big}>{formatPHP(principal)}</Text>
          <Text style={{ color: "#666", marginTop: 4 }}>Remaining: {formatPHP(remaining)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Choose Amount</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            {suggestedAmounts.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickBtn}
                onPress={() => quickSet(s)}
              >
                <Text style={{ fontWeight: "700" }}>{formatPHP(s)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View>
            <TextInput
              keyboardType="numeric"
              value={amount ? String(amount) : ""}
              onChangeText={(t) => setAmount(Number(t.replace(/[^\d.]/g, "") || 0))}
              placeholder="Enter amount (PHP)"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Method</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <TouchableOpacity
              style={[styles.methodBtn, method === "inapp" ? styles.methodBtnActive : undefined]}
              onPress={() => setMethod("inapp")}
            >
              <Text style={method === "inapp" ? styles.methodTextActive : styles.methodText}>In-App (Simulated)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodBtn, method === "gcash" ? styles.methodBtnActive : undefined]}
              onPress={() => setMethod("gcash")}
            >
              <Text style={method === "gcash" ? styles.methodTextActive : styles.methodText}>GCash</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodBtn, method === "bank" ? styles.methodBtnActive : undefined]}
              onPress={() => setMethod("bank")}
            >
              <Text style={method === "bank" ? styles.methodTextActive : styles.methodText}>Bank</Text>
            </TouchableOpacity>
          </View>

          {(method === "gcash" || method === "bank") && (
            <>
              <Text style={{ marginTop: 12, color: "#666" }}>Account / Reference</Text>
              <TextInput
                placeholder={method === "gcash" ? "GCash mobile number" : "Bank account / reference"}
                value={receiver}
                onChangeText={setReceiver}
                style={styles.input}
              />
            </>
          )}
        </View>

        <TouchableOpacity style={styles.payNowBtn} onPress={submitPayment} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payNowText}>Confirm Payment</Text>}
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 50, paddingBottom: 18, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 20 },

  card: { backgroundColor: "#fff", padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: "#e6f2fb" },
  sectionTitle: { fontWeight: "700", marginBottom: 8 },

  big: { fontSize: 24, fontWeight: "900", color: "#169AF9" },

  quickBtn: { backgroundColor: "#f3f8fb", padding: 10, borderRadius: 8, minWidth: 110, alignItems: "center" },

  input: {
    borderWidth: 1,
    borderColor: "#cfeefc",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },

  methodBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#f3f8fb", marginHorizontal: 6, alignItems: "center" },
  methodBtnActive: { backgroundColor: "#169AF9" },
  methodText: { fontWeight: "700" },
  methodTextActive: { color: "#fff", fontWeight: "700" },

  payNowBtn: { backgroundColor: "#169AF9", paddingVertical: 14, borderRadius: 10, alignItems: "center", marginHorizontal: 16, marginTop: 6 },
  payNowText: { color: "#fff", fontWeight: "800" },
});
