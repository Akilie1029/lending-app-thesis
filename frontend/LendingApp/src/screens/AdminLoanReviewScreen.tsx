// src/screens/AdminLoanReviewScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import api from "../services/api";

const PRIMARY = "#169AF9";
const BORDER = "#D6E8FF";
const CARD_BG = "#FFFFFF";

export default function AdminLoanReviewScreen() {
  const navigation: any = useNavigation();
  const route: any = useRoute();
  const loanId = route.params?.loanId;

  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState(false);

  // -----------------------------------------------------
  // Load loan details
  // -----------------------------------------------------
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

  // -----------------------------------------------------
  // Approve Loan
  // -----------------------------------------------------
  const approveLoan = () => {
    Alert.alert("Approve Loan", "Are you sure you want to approve this loan?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            setProcessingAction(true);
            await api.post(`/admin/approve/${loanId}`);
            Alert.alert("Approved", "Loan has been approved.");
            navigation.goBack();
          } catch (err) {
            console.log("❌ Approve Error:", err?.response?.data || err);
            Alert.alert("Error", "Failed to approve loan.");
          } finally {
            setProcessingAction(false);
          }
        },
      },
    ]);
  };

  // -----------------------------------------------------
  // Reject Loan
  // -----------------------------------------------------
  const rejectLoan = () => {
    Alert.alert("Reject Loan", "Reject this loan application?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            setProcessingAction(true);
            await api.post(`/admin/reject/${loanId}`);
            Alert.alert("Rejected", "Loan has been rejected.");
            navigation.goBack();
          } catch (err) {
            console.log("❌ Reject Error:", err?.response?.data || err);
            Alert.alert("Error", "Failed to reject loan.");
          } finally {
            setProcessingAction(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!loan) {
    return (
      <View style={styles.loaderWrap}>
        <Text>Loan not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Review</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160 }}>
        {/* AMOUNT CARD */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Loan Amount</Text>
          <Text style={styles.amount}>
            ₱ {Number(loan.principal).toLocaleString()}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Term</Text>
            <Text style={styles.infoValue}>{loan.days} days</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Purpose</Text>
            <Text style={styles.infoValue}>{loan.purpose}</Text>
          </View>
        </View>

        {/* BORROWER INFORMATION */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Borrower Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{loan.full_name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date of Birth</Text>
            <Text style={styles.infoValue}>{loan.date_of_birth}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{loan.phone_number}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>{loan.address}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Employment</Text>
            <Text style={styles.infoValue}>{loan.employment_status}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Income</Text>
            <Text style={styles.infoValue}>{loan.monthly_income_range}</Text>
          </View>
        </View>

        {/* PAYOUT DETAILS */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Payout Details</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Method</Text>
            <Text style={styles.infoValue}>{loan.payout_method}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account</Text>
            <Text style={styles.infoValue}>{loan.payout_details?.account}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{loan.payout_details?.name}</Text>
          </View>

          {loan.payout_method === "bank" && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bank</Text>
              <Text style={styles.infoValue}>{loan.payout_details?.bank}</Text>
            </View>
          )}
        </View>

        {/* DOCUMENTS */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Documents</Text>

          <View style={{ flexDirection: "row", marginTop: 12 }}>
            <TouchableOpacity
              style={styles.docThumbWrap}
              onPress={() =>
                navigation.navigate("AdminLoanDocuments", { loanId })
              }
            >
              <Image
                source={{ uri: loan.valid_id_url }}
                style={styles.docThumb}
              />
              <Text style={styles.docLabel}>ID</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.docThumbWrap}
              onPress={() =>
                navigation.navigate("AdminLoanDocuments", { loanId })
              }
            >
              <Image
                source={{ uri: loan.selfie_id_url }}
                style={styles.docThumb}
              />
              <Text style={styles.docLabel}>Selfie</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.docThumbWrap}
              onPress={() =>
                navigation.navigate("AdminLoanDocuments", { loanId })
              }
            >
              <Image
                source={{ uri: loan.proof_income_url }}
                style={styles.docThumb}
              />
              <Text style={styles.docLabel}>Proof</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ACTION BUTTONS */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.rejectBtn]}
            disabled={processingAction}
            onPress={rejectLoan}
          >
            <Text style={styles.btnText}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.approveBtn]}
            disabled={processingAction}
            onPress={approveLoan}
          >
            <Text style={styles.btnText}>Approve</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// =========================================================
// STYLES — Clean Modern Fintech
// =========================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F8FF" },

  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    backgroundColor: PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "700",
    marginLeft: 10,
  },

  card: {
    backgroundColor: CARD_BG,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    elevation: 2,
  },

  cardLabel: { fontSize: 15, fontWeight: "700", color: "#1A3C57", marginBottom: 10 },

  amount: {
    fontSize: 28,
    fontWeight: "700",
    color: PRIMARY,
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: { color: "#7289A3", fontSize: 13 },
  infoValue: { color: "#0A2A43", fontSize: 13, fontWeight: "600" },

  docThumbWrap: { marginRight: 12, alignItems: "center" },
  docThumb: {
    width: 70,
    height: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  docLabel: { fontSize: 12, marginTop: 4, color: "#4A5D73" },

  buttonRow: {
    flexDirection: "row",
    marginTop: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 6,
  },
  approveBtn: { backgroundColor: PRIMARY },
  rejectBtn: { backgroundColor: "#FF4D4F" },
  btnText: { color: "#fff", fontWeight: "700" },
});
