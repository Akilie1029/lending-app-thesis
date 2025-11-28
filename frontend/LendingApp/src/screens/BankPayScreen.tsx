// src/screens/BankPayScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import { useRoute, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE } from "../config";

export default function BankPayScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const loan = route.params?.loan;
  const amount = Number(route.params?.amount ?? loan?.daily_payment ?? 0);

  const [refNumber, setRefNumber] = useState("");
  const [loading, setLoading] = useState(false);

  if (!loan) {
    return (
      <View style={styles.center}>
        <Text>No loan selected.</Text>
      </View>
    );
  }

  const handlePay = async () => {
    if (refNumber.trim().length < 5) {
      Alert.alert("Missing Reference", "Enter a valid transaction reference.");
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");

      await axios.post(
        `${API_BASE}/loans/${loan.id}/pay`,
        {
          amount,
          method: "bank",
          metadata: {
            reference: refNumber,
            simulated: true,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLoading(false);

      Alert.alert("Success", "Bank payment submitted.", [
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
      console.error("Bank payment error", err?.response?.data);
      setLoading(false);

      Alert.alert(
        "Failed",
        err?.response?.data?.message || "Unable to complete payment."
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Bank Transfer</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      <View style={styles.container}>
        <Text style={styles.label}>Amount to Pay</Text>
        <Text style={styles.value}>₱ {amount.toLocaleString()}</Text>

        <Text style={styles.inputLabel}>Reference Number</Text>
        <TextInput
          placeholder="Enter bank transaction reference"
          value={refNumber}
          onChangeText={setRefNumber}
          style={styles.input}
        />

        <TouchableOpacity
          style={styles.payBtn}
          onPress={handlePay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payText}>Submit Bank Payment</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 50, paddingBottom: 18, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },

  container: { padding: 20, marginTop: 20 },

  label: { color: "#666" },
  value: { fontSize: 28, fontWeight: "900", marginBottom: 10 },

  inputLabel: { marginTop: 12, marginBottom: 6, color: "#666" },
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
    marginTop: 20,
  },
  payText: { color: "#fff", fontWeight: "800" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
