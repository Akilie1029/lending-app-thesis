// src/screens/AdminLoanReviewScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import api from "../services/api";

const PRIMARY = "#169AF9";

export default function AdminLoanReviewScreen() {
  const route = useRoute<any>();
  const navigation: any = useNavigation();

  const loanId = route.params?.loanId;

  const [loading, setLoading] = useState(true);
  const [loan, setLoan] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  // --------------------------------------------------------
  // Load loan details
  // --------------------------------------------------------
  const loadLoan = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/loan/${loanId}/details`);
      setLoan(res.data.loan);
      setSchedule(res.data.schedule || []);
      setHistory(res.data.repayment_history || []);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.log("❌ Admin loan load error:", err?.response?.data || err);
      Alert.alert("Error", "Unable to load loan details");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLoan();
    }, [])
  );

  // --------------------------------------------------------
  // Reject Loan
  // --------------------------------------------------------
  const rejectLoan = () => {
    Alert.alert(
      "Reject Loan",
      "Reject this loan application?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessing(true);
              await api.post(`/admin/reject/${loanId}`);
              Alert.alert("Rejected", "Loan application rejected.");
              navigation.goBack();
            } catch (err) {
              console.log("❌ reject error:", err?.response?.data || err);
              Alert.alert("Error", "Failed to reject loan.");
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  // --------------------------------------------------------
  // Approve Loan
  // --------------------------------------------------------
  const approveLoan = async () => {
    Alert.alert("Approve Loan", "Approve this loan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            setProcessing(true);
            await api.post(`/admin/approve/${loanId}`, {});
            Alert.alert("Approved", "Loan approved successfully!");
            navigation.goBack();
          } catch (err) {
            console.log("❌ approve error:", err?.response?.data || err);
            Alert.alert("Error", "Failed to approve loan.");
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  // --------------------------------------------------------
  // Loading State
  // --------------------------------------------------------
  if (loading || !loan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 10 }}>Loading loan details...</Text>
      </View>
    );
  }

  // --------------------------------------------------------
  // UI
  // --------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Review</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Borrower Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Borrower Information</Text>

          <Row label="Name" value={loan.user_full_name} />
          <Row label="Email" value={loan.user_email} />
          <Row label="Phone" value={loan.phone_number} />
          <Row label="Address" value={loan.address} />
          <Row label="Employment" value={loan.employment_status} />
          <Row label="Income Range" value={loan.monthly_income_range} />
        </View>

        {/* Loan Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loan Details</Text>

          <Row
            label="Principal"
            value={`₱ ${Number(loan.principal).toLocaleString()}`}
          />
          <Row label="Term" value={`${loan.days} days`} />
          <Row label="Purpose" value={loan.purpose} />
          <Row label="Payout Method" value={loan.payout_method} />
          <Row
            label="Submitted"
            value={new Date(loan.created_at).toLocaleString()}
          />
        </View>

        {/* Documents */}
        <TouchableOpacity
          style={styles.docBtn}
          onPress={() =>
            navigation.navigate("AdminLoanDocuments", { loanId: loan.id })
          }
        >
          <Icon name="document-text-outline" size={20} color={PRIMARY} />
          <Text style={styles.docBtnText}>View Uploaded Documents</Text>
        </TouchableOpacity>

        {/* Schedule Preview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Repayment Schedule</Text>
          {schedule.slice(0, 5).map((i, idx) => (
            <Row
              key={idx}
              label={`Day ${i.installment_number}`}
              value={`₱ ${Number(i.amount_due).toFixed(2)}`}
            />
          ))}
          {schedule.length > 5 && (
            <Text style={styles.moreText}>
              + {schedule.length - 5} more installments...
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={rejectLoan}
            disabled={processing}
          >
            <Text style={styles.actionText}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={approveLoan}
            disabled={processing}
          >
            <Text style={styles.actionText}>Approve</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* --------------------------------------------------------
   Small Reusable Row Component
-------------------------------------------------------- */
const Row = ({ label, value }: { label: string; value: any }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value ?? "—"}</Text>
  </View>
);

/* --------------------------------------------------------
   Styles
-------------------------------------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F8FF" },

  header: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 45,
  },
  headerTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#D5E8FF",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10, color: "#0A2A43" },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowLabel: { color: "#7A8DA6", fontSize: 14 },
  rowValue: { fontWeight: "700", color: "#0A2A43" },

  moreText: {
    marginTop: 6,
    color: PRIMARY,
    fontWeight: "700",
    textAlign: "right",
  },

  docBtn: {
    marginTop: 20,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "#E8F3FF",
    borderRadius: 12,
  },
  docBtnText: {
    marginLeft: 8,
    color: PRIMARY,
    fontWeight: "700",
  },

  actionRow: {
    flexDirection: "row",
    marginTop: 30,
    marginHorizontal: 16,
    marginBottom: 40,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 6,
  },
  rejectBtn: { backgroundColor: "#FF4D4F" },
  approveBtn: { backgroundColor: PRIMARY },
  actionText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
});

