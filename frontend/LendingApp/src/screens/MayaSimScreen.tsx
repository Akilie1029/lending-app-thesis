import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_BASE = "http://192.168.1.222:5001/api";

export default function MayaPayScreen({ route, navigation }: any) {
  const { loan, amount } = route.params;
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    if (pin.length !== 6) {
      Alert.alert("Maya PIN Required", "Enter your 6-digit PIN.");
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");

      await axios.post(
        `${API_BASE}/loans/${loan.id}/pay`,
        {
          amount,
          method: "maya",
          metadata: { pin },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLoading(false);

      Alert.alert("Payment Success", "Maya payment recorded.", [
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
        err?.response?.data?.message || "Unable to complete Maya payment."
      );
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1CC75D", "#0CA54F"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Maya Payment</Text>
        <View style={{ width: 26 }} />
      </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.label}>Amount to Pay</Text>
        <Text style={styles.amount}>₱ {amount.toLocaleString()}</Text>

        <Text style={[styles.label, { marginTop: 15 }]}>Enter 6-digit PIN</Text>
        <TextInput
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          value={pin}
          onChangeText={setPin}
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
    borderColor: "#1CC75D",
  },
  label: { color: "#555", fontSize: 14 },
  amount: { fontSize: 32, fontWeight: "800" },
  input: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#ccc",
    fontSize: 20,
    letterSpacing: 6,
    textAlign: "center",
  },
  button: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#1CC75D",
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
