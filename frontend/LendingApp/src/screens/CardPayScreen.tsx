// src/screens/CardPayScreen.tsx
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

export default function CardPayScreen({ route, navigation }: any) {
  const loan = route.params?.loan;

  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [amount, setAmount] = useState(
    loan?.daily_payment ? String(loan.daily_payment) : ""
  );

  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!amount) return Alert.alert("Missing", "Enter payment amount.");
    if (!loan?.id) return Alert.alert("Error", "Loan missing.");
    if (!cardNumber || !expiry || !cvc)
      return Alert.alert("Missing", "Enter all card details.");

    try {
      setProcessing(true);
      const token = await AsyncStorage.getItem("userToken");

      // Fake 1.5s card processing
      await new Promise((res) => setTimeout(res, 1500));

      const res = await axios.post(
        `${API_BASE}/repayments/pay`,
        {
          loan_id: loan.id,
          amount: Number(amount),
          payment_method: "Card",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const payload = res.data;

      navigation.replace("PaymentReceipt", {
        payment: {
          amount: Number(amount),
          method: "Card",
          date: new Date().toISOString(),
          loanId: loan.id,
          transaction: payload.transaction,
          remaining: payload.remaining_balance,
        },
      });
    } catch (err: any) {
      console.error("Card payment error:", err?.response?.data || err);
      Alert.alert("Payment Failed", "Unable to process card payment.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <LinearGradient colors={["#8e44ad", "#6d2e8b"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Card Payment</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Card Number</Text>
        <TextInput
          value={cardNumber}
          onChangeText={setCardNumber}
          style={styles.input}
          keyboardType="numeric"
          placeholder="0000 0000 0000 0000"
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Expiry</Text>
            <TextInput
              value={expiry}
              onChangeText={setExpiry}
              style={styles.input}
              placeholder="MM/YY"
            />
          </View>

          <View style={{ width: 10 }} />

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>CVC</Text>
            <TextInput
              value={cvc}
              onChangeText={setCvc}
              style={styles.input}
              placeholder="123"
              secureTextEntry
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={[styles.label, { marginTop: 10 }]}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          style={styles.input}
          keyboardType="numeric"
        />

        {!processing ? (
          <TouchableOpacity style={styles.payBtn} onPress={handlePay}>
            <Text style={styles.payText}>Pay Now</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color="#6d2e8b" />
            <Text style={styles.processingText}>Processing Card Payment…</Text>
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
  label: { fontWeight: "700", fontSize: 13, color: "#333" },

  input: {
    borderWidth: 1.5,
    borderColor: "#8e44ad",
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
    fontSize: 16,
  },

  row: { flexDirection: "row" },

  payBtn: {
    backgroundColor: "#6d2e8b",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  payText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  processingBox: { alignItems: "center", paddingVertical: 20 },
  processingText: { marginTop: 10, color: "#6d2e8b", fontWeight: "700" },
});
