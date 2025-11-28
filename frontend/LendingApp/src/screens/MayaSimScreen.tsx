// src/screens/MayaSimScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
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

export default function MayaSimScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const loan = route.params?.loan;
  const amount = Number(route.params?.amount ?? loan?.daily_payment ?? 0);
  const [loading, setLoading] = useState(false);

  if (!loan) {
    return (
      <View style={styles.center}>
        <Text>No loan selected.</Text>
      </View>
    );
  }

  const handlePay = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");

      if (!token) {
        Alert.alert("Not logged in", "Please login to continue.");
        setLoading(false);
        return;
      }

      await axios.post(
        `${API_BASE}/loans/${loan.id}/pay`,
        {
          amount,
          method: "maya",
          metadata: { simulated: true },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setLoading(false);

      Alert.alert("Payment Successful", "Maya payment recorded.", [
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
      console.error("Maya error", err?.response?.data || err);
      setLoading(false);

      Alert.alert(
        "Failed",
        err?.response?.data?.message || "Unable to complete payment."
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <LinearGradient colors={["#8A2BE2", "#6A1BB0"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Maya Payment</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      <View style={styles.container}>
        <Text style={styles.label}>Amount to Pay</Text>
        <Text style={styles.value}>₱ {amount.toLocaleString()}</Text>

        <TouchableOpacity
          style={styles.payBtn}
          onPress={handlePay}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payText}>Confirm Maya Payment</Text>
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
  value: { fontSize: 28, fontWeight: "900", marginVertical: 10 },

  payBtn: {
    backgroundColor: "#8A2BE2",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  payText: { color: "#fff", fontWeight: "800" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
