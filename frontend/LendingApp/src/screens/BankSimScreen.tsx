// src/screens/BankSimScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../config";

export default function BankSimScreen({ route, navigation }: any) {
  const loan = route.params?.loan;
  const [amount, setAmount] = useState(
    loan?.daily_payment ? String(loan.daily_payment) : ""
  );

  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!amount) return Alert.alert("Missing", "Enter payment amount.");
    if (!loan?.id) return Alert.alert("Error", "Loan missing.");

    try {
      setProcessing(true);
      const token = await AsyncStorage.getItem("userToken");

      // Fake 1.5s bank processing
      await new Promise((res) => setTimeout(res, 1500));

      const res = await axios.post(
        `${API_BASE}/repayments/pay`,
        {
          loan_id: loan.id,
          amount: Number(amount),
          payment_method: "Bank",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const payload = res.data;

      navigation.replace("PaymentReceipt", {
        payment: {
          amount: Number(amount),
          method: "Bank Transfer",
          date: new Date().toISOString(),
          loanId: loan.id,
          transaction: payload.transaction || null,
          remaining: payload.remaining_balance,
        },
      });
    } catch (err: any) {
      console.error("Bank payment error:", err?.response?.data || err);
      Alert.alert("Payment Failed", "Unable to process payment.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <LinearGradient colors={["#0066cc", "#004c99"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bank Transfer</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Enter Amount</Text>

        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
          placeholder="0.00"
        />

        {!processing ? (
          <TouchableOpacity style={styles.payBtn} onPress={handlePay}>
            <Text style={styles.payText}>Pay via Bank</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color="#004c99" />
            <Text style={styles.processingText}>Processing Bank Transfer…</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 18 },

  card: {
    marginTop: 40,
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 18,
    padding: 20,
    elevation: 5,
  },
  title: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  input: {
    borderWidth: 1.5,
    borderColor: "#0066cc",
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    marginBottom: 20,
  },
  payBtn: {
    backgroundColor: "#004c99",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  payText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  processingBox: { alignItems: "center", paddingVertical: 20 },
  processingText: { marginTop: 10, color: "#004c99", fontWeight: "700" },
});
