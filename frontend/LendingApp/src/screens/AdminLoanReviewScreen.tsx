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

      console.log(
        "📥 Loan Details Response:",
        JSON.stringify(res.data, null, 2)
      );

      setLoan(res.data.loan);
    } catch (err) {
      console.log(
        "❌ Loan detail load error:",
        err?.response?.data || err?.message || err
      );
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
        onPress: async () => {
          try {
            setProcessing(true);

            console.log(
              "📤 Sending APPROVE request to:",
              `/admin/approve/${loanId}`
            );

            const res = await api.post(`/admin/approve/${loanId}`);

            console.log("✅ APPROVE Response:", res.data);

            Alert.alert(
            "Approved",
            "Loan has been approved.",
            [
                {
                text: "OK",
                onPress: () => {
                    console.log("🎯 Approved → navigating user back to AdminDashboard");
                    navigation.navigate("AdminDashboard");
                },
                },
            ],
            { cancelable: false }
            );

          } catch (err) {
            console.log(
              "❌ Approve loan error:",
              err?.response?.status,
              err?.response?.data,
              err?.message
            );
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

            console.log(
              "📤 Sending REJECT request to:",
              `/admin/reject/${loanId}`
            );

            const res = await api.post(`/admin/reject/${loanId}`);

            console.log("⛔ Reject Response:", res.data);

            Alert.alert("Rejected", "Loan has been rejected.");
            navigation.goBack();
          } catch (err) {
            console.log(
              "❌ Reject loan error:",
              err?.response?.status,
              err?.response?.data,
              err?.message
            );
            Alert.alert("Error", "Unable to reject loan.");
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Review</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* BORROWER INFO */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Borrower Information</Text>

        <InfoRow label="Full Name" value={loan.full_name} />
        <InfoRow label="Email" value={loan.user_email} />
        <InfoRow label="Date of Birth" value={loan.date_of_birth} />
        <InfoRow label="Address" value={loan.address} />
        <InfoRow label="Phone Number" value={loan.phone_number} />
        <InfoRow label="Employment Status" value={loan.employment_status} />
        <InfoRow label="Company / Business" value={loan.company_name} />
        <InfoRow label="Income Range" value={loan.monthly_income_range} />
      </View>

      {/* LOAN INFO */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Loan Details</Text>

        <InfoRow label="Principal" value={`₱ ${Number(loan.principal).toLocaleString()}`} />
        <InfoRow label="Interest" value={`₱ ${Number(loan.interest).toLocaleString()}`} />
        <InfoRow label="Total Payable" value={`₱ ${Number(loan.total_payable).toLocaleString()}`} />
        <InfoRow label="Daily Payment" value={`₱ ${Number(loan.daily_payment).toLocaleString()}`} />
        <InfoRow label="Duration" value={`${loan.days} days`} />
        <InfoRow label="Purpose" value={loan.purpose} />
      </View>

      {/* PAYOUT INFO */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Payout Method</Text>

        <InfoRow label="Method" value={loan.payout_method.toUpperCase()} />

        {loan.payout_method === "bank" && (
          <InfoRow label="Bank Name" value={loan.payout_details?.bank} />
        )}

        <InfoRow label="Account Name" value={loan.payout_details?.name} />
        <InfoRow label="Account Number" value={loan.payout_details?.account} />
      </View>

      {/* DOCUMENTS */}
      <TouchableOpacity
        style={styles.docBtn}
        onPress={() => navigation.navigate("AdminLoanDocuments", { loanId: loan.id })}
      >
        <Icon name="document-text-outline" size={20} color="#169AF9" />
        <Text style={styles.docBtnText}>View Uploaded Documents</Text>
      </TouchableOpacity>

      {/* APPROVE / REJECT */}
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

function InfoRow({ label, value }: any) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ?? "-"}</Text>
    </View>
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
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  label: { color: "#777", fontSize: 13, marginBottom: 2 },
  value: { color: "#000", fontWeight: "800", fontSize: 15 },
  docBtn: {
    backgroundColor: "#fff",
    padding: 14,
    margin: 16,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  docBtnText: {
    marginLeft: 8,
    color: "#169AF9",
    fontWeight: "700",
    fontSize: 15,
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    justifyContent: "space-between",
    marginTop: 20,
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
