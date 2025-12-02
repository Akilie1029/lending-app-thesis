// src/screens/AdminLoanReviewScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import api from "../services/api";

export default function AdminLoanReviewScreen({ navigation, route }: any) {
  const loanId = route.params?.loanId;

  const [loan, setLoan] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadDetails();
  }, []);

  const loadDetails = async () => {
    try {
      setLoading(true);

      console.log("📡 Fetching loan details for loanId:", loanId);

      const res = await api.get(`/admin/loan/${loanId}/details`);
      console.log("📥 Loan Details Response:", res.data);

      setLoan(res.data.loan);
      setSchedule(res.data.schedule || []);
    } catch (err) {
      console.error("❌ Loan detail load error:", err?.response?.data || err);
      Alert.alert("Error", "Unable to load loan details.");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const approveLoan = async () => {
    Alert.alert("Confirm", "Approve this loan application?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        style: "default",
        onPress: async () => {
          try {
            setProcessing(true);
            console.log("➡️ Approving loan:", loanId);

            await api.post(`/admin/loan/${loanId}/approve`);
            Alert.alert("Approved", "Loan has been approved.");
            navigation.goBack();
          } catch (err) {
            console.error("❌ Approve loan error:", err?.response?.data || err);
            Alert.alert("Error", "Unable to approve loan.");
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const rejectLoan = async () => {
    Alert.alert("Confirm", "Reject this loan application?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            setProcessing(true);
            console.log("➡️ Rejecting loan:", loanId);

            await api.post(`/admin/loan/${loanId}/reject`);
            Alert.alert("Rejected", "Loan has been rejected.");
            navigation.goBack();
          } catch (err) {
            console.error("❌ Reject loan error:", err?.response?.data || err);
            Alert.alert("Error", "Unable to reject loan.");
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const viewDocuments = () => {
    console.log("➡️ Viewing documents for loanId:", loanId);
    navigation.navigate("AdminLoanDocumentsScreen", { loanId });
  };

  if (loading || !loan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#169AF9" />
        <Text style={{ marginTop: 10 }}>Loading loan details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 10 }}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Review</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* LOAN INFO CARD */}
      <View style={styles.card}>
        <Text style={styles.title}>Borrower Information</Text>

        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{loan.full_name}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{loan.email}</Text>

        <View style={styles.divider} />

        <Text style={styles.title}>Loan Details</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Amount</Text>
          <Text style={styles.value}>₱ {loan.principal.toLocaleString()}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Term</Text>
          <Text style={styles.value}>{loan.days} days</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Daily Payment</Text>
          <Text style={styles.value}>₱ {loan.daily_payment.toLocaleString()}</Text>
        </View>

        <TouchableOpacity style={styles.docBtn} onPress={viewDocuments}>
          <Icon name="document-text-outline" size={20} color="#169AF9" />
          <Text style={styles.docBtnText}>View Uploaded Documents</Text>
        </TouchableOpacity>
      </View>

      {/* SCHEDULE */}
      <View style={styles.card}>
        <Text style={styles.title}>Repayment Schedule</Text>

        {schedule.length === 0 ? (
          <Text style={{ color: "#777", marginTop: 8 }}>No schedule available.</Text>
        ) : (
          schedule.map((item, i) => (
            <View key={i} style={styles.scheduleRow}>
              <Text style={{ fontWeight: "700" }}>Day {item.day_number}</Text>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.smallValue}>
                  ₱ {Number(item.expected_amount).toLocaleString()}
                </Text>
                <Text style={[styles.scheduleStatus, item.status === "paid" ? styles.green : styles.orange]}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* APPROVE / REJECT BUTTONS */}
      {loan.status === "pending" && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#28a745" }]}
            onPress={approveLoan}
            disabled={processing}
          >
            <Text style={styles.actionText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#dc3545" }]}
            onPress={rejectLoan}
            disabled={processing}
          >
            <Text style={styles.actionText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    backgroundColor: "#169AF9",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 12,
    elevation: 3,
  },
  title: { fontSize: 17, fontWeight: "800", marginBottom: 12 },

  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  label: { color: "#777" },
  value: { fontWeight: "800", color: "#000" },

  smallValue: { fontWeight: "700", color: "#000" },

  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 12,
  },

  scheduleRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scheduleStatus: { marginTop: 4, fontWeight: "700", fontSize: 12 },
  green: { color: "#19d06b" },
  orange: { color: "#e69500" },

  docBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  docBtnText: {
    color: "#169AF9",
    fontWeight: "700",
    marginLeft: 8,
  },

  actionRow: {
    flexDirection: "row",
    marginTop: 20,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 6,
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
