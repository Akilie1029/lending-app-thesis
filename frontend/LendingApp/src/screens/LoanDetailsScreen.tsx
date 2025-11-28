// src/screens/LoanDetailsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import { useRoute, useNavigation } from "@react-navigation/native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../config";

export default function LoanDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const passedLoan = route.params?.loan;
  const passedLoanId = route.params?.loanId;

  const [loan, setLoan] = useState<any>(passedLoan || null);
  const [loading, setLoading] = useState<boolean>(!passedLoan);

  const id = passedLoan?.id ?? passedLoanId;

  useEffect(() => {
    if (!id || passedLoan) return;

    (async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem("userToken");
        if (!token) throw new Error("Not authenticated");

        const res = await axios.get(`${API_BASE}/loans/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // backend may return { loan: {...} } or the loan object directly
        const data = res.data?.loan ?? res.data;
        setLoan(data);
      } catch (err: any) {
        console.error("Loan details error:", err?.response?.data || err.message);
        Alert.alert("Error", "Unable to load loan details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, passedLoan]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  if (!loan) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#666" }}>Loan not found.</Text>
      </View>
    );
  }

  const principal = Number(loan.principal ?? loan.amount_requested ?? 0);
  const total = Number(loan.total_payable ?? 0);
  const remaining = Number(loan.remaining_balance ?? 0);
  const daily = Number(loan.daily_payment ?? 0);

  const status = String(loan.status ?? "").toLowerCase();

  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString();
  };

  const openUrl = async (url?: string | null) => {
    if (!url) {
      Alert.alert("Not available", "No URL to open.");
      return;
    }
    const ok = await Linking.canOpenURL(url);
    if (ok) {
      Linking.openURL(url);
    } else {
      Alert.alert("Cannot open", "Unable to open this URL.");
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <LinearGradient
        colors={["#169AF9", "#37AAF2"]}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Details</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Principal</Text>
            <Text style={styles.smallLabel}>{formatDate(loan.created_at)}</Text>
          </View>
          <Text style={styles.value}>₱ {principal.toLocaleString()}</Text>

          <View style={{ height: 10 }} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Total Payable</Text>
              <Text style={styles.smallValue}>₱ {total.toLocaleString()}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Daily Payment</Text>
              <Text style={styles.smallValue}>₱ {daily.toLocaleString()}</Text>
            </View>
          </View>

          <View style={{ height: 10 }} />

          <Text style={styles.label}>Remaining Balance</Text>
          <Text style={[styles.value, { color: "#D62828" }]}>
            ₱ {remaining.toLocaleString()}
          </Text>

          <View style={{ height: 10 }} />

          <Text style={styles.label}>Status</Text>
          <Text style={styles.smallValue}>{(loan.status ?? "—").toString().toUpperCase()}</Text>

          <View style={{ height: 10 }} />

          <Text style={styles.label}>Purpose</Text>
          <Text style={styles.small}>{loan.purpose ?? "—"}</Text>

          <View style={{ height: 10 }} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Term</Text>
              <Text style={styles.small}>{loan.days ?? "—"} days</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Applied</Text>
              <Text style={styles.small}>{formatDate(loan.created_at)}</Text>
            </View>
          </View>

          {loan.disbursed_at ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Disbursed At</Text>
              <Text style={styles.small}>{formatDate(loan.disbursed_at)}</Text>
            </View>
          ) : null}

          {loan.latest_due_date ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Next Due</Text>
              <Text style={styles.small}>{formatDate(loan.latest_due_date)}</Text>
            </View>
          ) : null}

          {loan.last_payment_date ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Last Payment</Text>
              <Text style={styles.small}>{formatDate(loan.last_payment_date)}</Text>
            </View>
          ) : null}
        </View>

        {/* Documents */}
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={[styles.sectionTitle]}>Documents</Text>

          {/* Government ID */}
          {loan.government_id_url ? (
            <TouchableOpacity onPress={() => openUrl(loan.government_id_url)}>
              <Image
                source={{ uri: loan.government_id_url }}
                style={styles.docPreview}
                resizeMode="cover"
              />
              <Text style={styles.docLabel}>Government ID (tap to open)</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.small}>No government ID uploaded</Text>
          )}

          {/* Selfie with ID */}
          <View style={{ height: 8 }} />
          {loan.selfie_with_id_url ? (
            <TouchableOpacity onPress={() => openUrl(loan.selfie_with_id_url)}>
              <Image
                source={{ uri: loan.selfie_with_id_url }}
                style={styles.docPreview}
                resizeMode="cover"
              />
              <Text style={styles.docLabel}>Selfie with ID (tap to open)</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.small}>No selfie uploaded</Text>
          )}

          {/* Proof of funds */}
          <View style={{ height: 8 }} />
          {loan.proof_of_funds_url || loan.proof_of_income_url ? (
            <TouchableOpacity
              onPress={() =>
                openUrl(loan.proof_of_funds_url ?? loan.proof_of_income_url)
              }
            >
              <Image
                source={{ uri: loan.proof_of_funds_url ?? loan.proof_of_income_url }}
                style={styles.docPreview}
                resizeMode="cover"
              />
              <Text style={styles.docLabel}>Proof of Income (tap to open)</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.small}>No proof of income uploaded</Text>
          )}
        </View>

        {/* Actions */}
        <View style={{ marginTop: 18 }}>
          {(status === "active" || status === "approved") && (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => navigation.navigate("RepayLoan", { loan })}
            >
              <Text style={styles.payText}>Make a Payment</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.secondaryBtn, { marginTop: 12 }]}
            onPress={() => navigation.navigate("Payment History")}
          >
            <Text style={styles.secondaryText}>View Transactions</Text>
          </TouchableOpacity>

          {/* If admin needs to disburse/approve, those screens should be used from admin nav */}
        </View>

        <View style={{ height: 60 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 20 },

  container: { padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    borderWidth: 2,
    borderColor: "#e8f4ff",
  },

  label: { color: "#666", marginTop: 6, fontSize: 13 },
  value: { fontSize: 22, fontWeight: "900", marginTop: 4 },

  small: { fontSize: 14, color: "#444", marginTop: 4 },
  smallValue: { fontSize: 16, fontWeight: "700", color: "#000", marginTop: 4 },

  sectionTitle: { fontWeight: "800", fontSize: 16, marginBottom: 12 },

  docPreview: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    backgroundColor: "#f2f6fb",
  },
  docLabel: { marginTop: 8, color: "#0077C8", fontWeight: "700" },

  payBtn: {
    backgroundColor: "#169AF9",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  payText: { color: "#fff", fontWeight: "800" },

  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: "#169AF9",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryText: { color: "#169AF9", fontWeight: "700" },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
