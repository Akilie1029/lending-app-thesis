// src/screens/CardPayScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import { useRoute, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE } from "../config";

export default function CardPayScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const loan = route.params?.loan;
  const amount = Number(route.params?.amount ?? loan?.daily_payment ?? 0);

  const [cardNumber, setCardNumber] = useState("");
  const [expDate, setExpDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);

  if (!loan) {
    return (
      <View style={styles.center}>
        <Text>No loan selected.</Text>
      </View>
    );
  }

  const handlePay = async () => {
    if (cardNumber.length < 12 || expDate.length < 4 || cvv.length < 3) {
      Alert.alert("Invalid Input", "Please enter valid card details.");
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");

      await axios.post(
        `${API_BASE}/loans/${loan.id}/pay`,
        {
          amount,
          method: "card",
          metadata: {
            cardNumber,
            expDate,
            cvv,
            simulated: true,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLoading(false);

      Alert.alert("Payment Successful", "Card payment recorded.", [
        {
          text: "OK",
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: "Home" }],
            }),
        },
      ]);
    } catch (err: any) {
      console.error("Card payment error", err?.response?.data || err);

      setLoading(false);
      Alert.alert(
        "Failed",
        err?.response?.data?.message || "Unable to complete payment."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f6f7fb" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Card Payment</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      <View style={styles.container}>
        <Text style={styles.label}>Amount to Pay</Text>
        <Text style={styles.value}>₱ {amount.toLocaleString()}</Text>

        <Text style={styles.inputLabel}>Card Number</Text>
        <TextInput
          placeholder="1234 5678 9012 3456"
          keyboardType="numeric"
          value={cardNumber}
          onChangeText={setCardNumber}
          style={styles.input}
        />

        <Text style={styles.inputLabel}>Expiry Date (MM/YY)</Text>
        <TextInput
          placeholder="08/28"
          value={expDate}
          onChangeText={setExpDate}
          style={styles.input}
        />

        <Text style={styles.inputLabel}>CVV</Text>
        <TextInput
          placeholder="123"
          keyboardType="numeric"
          secureTextEntry
          value={cvv}
          onChangeText={setCvv}
          style={styles.input}
        />

        <TouchableOpacity style={styles.payBtn} onPress={handlePay} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payText}>Confirm Card Payment</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },

  container: { padding: 20, marginTop: 20 },
  label: { color: "#666" },
  value: { fontSize: 28, fontWeight: "900", marginBottom: 20 },

  inputLabel: { marginTop: 10, marginBottom: 4, color: "#444" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
  },

  payBtn: {
    backgroundColor: "#169AF9",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  payText: { color: "#fff", fontWeight: "800" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
