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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import api from "../services/api";

const LOG_PREFIX = "[ADMIN_LOAN_REVIEW]";

export default function AdminLoanReviewScreen({ navigation, route }: any) {
  const loanId = route.params?.loanId;

  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Modal & approved amount states
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [approvedAmountInput, setApprovedAmountInput] = useState<string>("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  useEffect(() => {
    loadDetails();
  }, []);

  const loadDetails = async () => {
    try {
      setLoading(true);
      console.log(LOG_PREFIX, "📡 Fetching loan details for loanId:", loanId);

      const res = await api.get(`/admin/loan/${loanId}/details`);

      console.log(LOG_PREFIX, "📥 Loan Details Response:", JSON.stringify(res.data, null, 2));

      setLoan(res.data.loan);
    } catch (err) {
      console.log(LOG_PREFIX, "❌ Loan detail load error:", err?.response?.data || err?.message || err);
      Alert.alert("Error", "Unable to load loan details.");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Open approve modal and prefill with requested principal (as string)
  const openApproveModal = () => {
    const requested = Number(loan?.principal ?? loan?.amount_requested ?? 0);
    setApprovedAmountInput(requested ? String(requested) : "");
    setApproveError(null);
    setApproveModalVisible(true);
  };

  const closeApproveModal = () => {
    setApproveModalVisible(false);
    setApproveError(null);
    setApprovedAmountInput("");
  };

  // Validate approved amount
  const validateApprovedAmount = (val: string) => {
    if (!val || val.trim() === "") return "Please enter an amount.";
    const num = Number(val.replace(/,/g, ""));
    if (Number.isNaN(num) || !isFinite(num)) return "Invalid number.";
    if (num <= 0) return "Amount must be greater than 0.";
    const requested = Number(loan?.principal ?? loan?.amount_requested ?? 0);
    if (num > requested) return `Approved amount cannot exceed requested amount (₱ ${requested.toLocaleString()}).`;
    return null;
  };

  // Submit approval with approved_principal
  const submitApproval = async () => {
    const sanitized = approvedAmountInput.replace(/,/g, "");
    const err = validateApprovedAmount(sanitized);
    if (err) {
      setApproveError(err);
      return;
    }

    const approved_principal = Number(sanitized);

    Alert.alert(
      "Confirm Approval",
      `Approve loan with amount: ₱ ${approved_principal.toLocaleString()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            try {
              setSubmittingApproval(true);
              console.log(LOG_PREFIX, "➡️ Sending APPROVE request to:", `/admin/approve/${loanId}`, { approved_principal });

              const res = await api.post(`/admin/approve/${loanId}`, { approved_principal });

              console.log(LOG_PREFIX, "✅ APPROVE Response:", res.data);

              Alert.alert(
                "Approved",
                "Loan has been approved and borrower will be notified.",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      closeApproveModal();
                      navigation.navigate("AdminDashboard");
                    },
                  },
                ],
                { cancelable: false }
              );
            } catch (err: any) {
              console.log(LOG_PREFIX, "❌ Approve loan error:", err?.response?.status, err?.response?.data, err?.message);
              const msg =
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                "Unable to approve loan.";
              Alert.alert("Error", msg);
            } finally {
              setSubmittingApproval(false);
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const approveLoan = async () => {
    // Instead of immediate approve, open modal to input amount
    openApproveModal();
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

            console.log(LOG_PREFIX, "📤 Sending REJECT request to:", `/admin/reject/${loanId}`);

            const res = await api.post(`/admin/reject/${loanId}`);

            console.log(LOG_PREFIX, "⛔ Reject Response:", res.data);

            Alert.alert("Rejected", "Loan has been rejected.");
            navigation.goBack();
          } catch (err) {
            console.log(LOG_PREFIX, "❌ Reject loan error:", err?.response?.status, err?.response?.data, err?.message);
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
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate("AdminLoanApprovalScreen")}>
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

          <InfoRow label="Method" value={loan.payout_method?.toUpperCase()} />

          {loan.payout_method === "bank" && <InfoRow label="Bank Name" value={loan.payout_details?.bank} />}

          <InfoRow label="Account Name" value={loan.payout_details?.name} />
          <InfoRow label="Account Number" value={loan.payout_details?.account} />
        </View>

        {/* DOCUMENTS */}
        <TouchableOpacity style={styles.docBtn} onPress={() => navigation.navigate("AdminLoanDocuments", { loanId: loan.id })}>
          <Icon name="document-text-outline" size={20} color="#169AF9" />
          <Text style={styles.docBtnText}>View Uploaded Documents</Text>
        </TouchableOpacity>

        {/* APPROVE / REJECT */}
        {loan.status === "pending" && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#28a745" }]} onPress={approveLoan} disabled={processing}>
              <Text style={styles.actionText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#dc3545" }]} onPress={rejectLoan} disabled={processing}>
              <Text style={styles.actionText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* APPROVE AMOUNT MODAL */}
      <Modal visible={approveModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter approved amount</Text>

            <Text style={styles.modalLabel}>Requested amount</Text>
            <Text style={styles.modalRequested}>₱ {Number(loan.principal ?? 0).toLocaleString()}</Text>

            <Text style={[styles.modalLabel, { marginTop: 12 }]}>Approved principal (₱)</Text>
            <TextInput
              style={styles.modalInput}
              value={approvedAmountInput}
              onChangeText={(t) => {
                // allow digits, commas and dot — keep string so user can format
                const cleaned = t.replace(/[^0-9.,]/g, "");
                setApprovedAmountInput(cleaned);
                setApproveError(null);
              }}
              keyboardType="numeric"
              placeholder="Enter approved amount"
            />
            {approveError ? <Text style={styles.modalError}>{approveError}</Text> : null}

            <View style={{ flexDirection: "row", marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#ddd" }]} onPress={closeApproveModal} disabled={submittingApproval}>
                <Text style={{ fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#28a745", marginLeft: 12 }]}
                onPress={submitApproval}
                disabled={submittingApproval}
              >
                {submittingApproval ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Approve</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
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

  /* Modal styles */
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 6,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  modalLabel: { fontSize: 13, color: "#666" },
  modalRequested: { fontSize: 16, fontWeight: "800", marginTop: 6 },
  modalInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e6eef6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalError: { color: "#cc0000", marginTop: 8 },

  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});
