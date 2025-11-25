import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_BASE = "http://192.168.1.222:5001/api";

export default function CardPayScreen({ route, navigation }: any) {
  const { loan, amount } = route.params;

  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (card.length < 16)
      return Alert.alert("Card Number Error", "Enter a valid card number.");
    if (!exp) return Alert.alert("Missing Expiry Date", "Enter expiry date.");
    if (cvv.length < 3) return Alert.alert("Missing CVV", "Enter CVV.");

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");

      await axios.post(
        `${API_BASE}/loans/${loan.id}/pay`,
        {
          amount,
          method: "card",
          metadata: { card, exp, cvv },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLoading(false);

      Alert.alert("Payment Success", "Card payment recorded.", [
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
      setLoading(false);
      Alert.alert(
        "Payment Failed",
        err?.response?.data?.message || "Unable to complete card payment."
      );
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Card Payment</Text>
        <View style={{ width: 26 }} />
      </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.label}>Amount to Pay</Text>
        <Text style={styles.amount}>₱ {amount.toLocaleString()}</Text>

        <Text style={[styles.label, { marginTop: 15 }]}>Card Number</Text>
        <TextInput
          placeholder="xxxx xxxx xxxx xxxx"
          keyboardType="numeric"
          maxLength={16}
          value={card}
          onChangeText={setCard}
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 15 }]}>Expiry (MM/YY)</Text>
        <TextInput placeholder="MM/YY" value={exp} onChangeText={setExp} style={styles.input} />

        <Text style={[styles.label, { marginTop: 15 }]}>CVV</Text>
        <TextInput
          placeholder="123"
          keyboardType="numeric"
          maxLength={4}
          value={cvv}
          onChangeText={setCvv}
          style={styles.input}
        />

        <TouchableOpacity style={styles.button} onPress={handlePay}>
          <Text style={styles.buttonText}>Pay Now</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator size="large" style={{ marginTop: 20 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },
  header: {
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  card: {
    backgroundColor: "#fff",
    margin: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#169AF9",
  },
  label: { fontSize: 14, color: "#666" },
  amount: { fontSize: 32, fontWeight: "800" },
  input: {
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#ccc",
    borderRadius: 10,
    marginTop: 6,
  },
  button: {
    marginTop: 20,
    backgroundColor: "#169AF9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
