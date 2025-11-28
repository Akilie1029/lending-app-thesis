// src/screens/PaymentHistoryScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Icon from "react-native-vector-icons/Ionicons";
import { API_BASE } from "../config";

export default function PaymentHistoryScreen({ navigation }: any) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        setPayments([]);
        setLoading(false);
        return;
      }

      const res = await axios.get(`${API_BASE}/transactions/my-payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPayments(Array.isArray(res.data) ? res.data : res.data?.payments ?? []);
    } catch (err) {
      console.error("❌ Failed to load payments:", err?.response?.data || err.message);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment History</Text>
      </View>

      {payments.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No payment history found</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 30 }}
          data={payments}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.type}>
                  {item.type ? item.type.replace(/_/g, " ") : "Payment"} •{" "}
                  {item.payment_method || "N/A"}
                </Text>

                <Text style={styles.amount}>
                  ₱ {Number(item.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>

              <Text style={styles.date}>
                {item.created_at ? new Date(item.created_at).toLocaleString() : "—"}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },

  header: {
    width: "100%",
    backgroundColor: "#169AF9",
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    elevation: 4,
  },
  backBtn: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  emptyWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#777", fontSize: 16 },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 15,
    marginVertical: 6,
    elevation: 3,
    borderWidth: 2,
    borderColor: "#169AF9",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  type: { fontSize: 16, fontWeight: "700", color: "#000", textTransform: "capitalize" },
  amount: { fontSize: 16, fontWeight: "700", color: "#169AF9" },
  date: { marginTop: 6, fontSize: 13, color: "#777" },
});
