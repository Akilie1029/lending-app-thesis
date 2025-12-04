// ---------------------------------------------------------
// ADMIN — PENDING DISBURSEMENTS SCREEN
// Shows loans with status = 'approved'
// (borrower already accepted — admin must disburse)
// ---------------------------------------------------------

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { format } from "date-fns";

import SmallHeader from "../components/SmallHeader";
import { BASE_URL } from "../config";

const LOG_PREFIX = "[ADMIN_DISBURSE_SCREEN]";

// Types for admin loans
type LoanRow = {
  id: string;
  full_name?: string;
  approved_principal?: number;
  approved_total_payable?: number;
  approved_daily_payment?: number;
  principal?: number;
  total_payable?: number;
  days?: number;
  status?: string;
  created_at?: string;
  approved_at?: string;
  disbursed_at?: string | null;

  gov_id_uri?: string | null;
  selfie_id_uri?: string | null;
  proof_uri?: string | null;
};

export default function AdminDisbursementScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [processingMap, setProcessingMap] = useState<Record<string, boolean>>({});

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // -------------------------------------------
  // AUTH HEADERS
  // -------------------------------------------
  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem("userToken");
    return { Authorization: token ? `Bearer ${token}` : "" };
  };

  // -------------------------------------------
  // Load loans
  // -------------------------------------------
  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();

      console.log(LOG_PREFIX, "📡 Fetching approved loans for disbursement…");

      const res = await axios.get(
        `${BASE_URL}/api/admin/disburse/pending`,
        { headers }
      );

      const list = Array.isArray(res.data?.loans)
        ? res.data.loans
        : [];

      console.log(LOG_PREFIX, "📥 Raw payload count:", list.length);

      // No normalizeLoan — use backend fields EXACTLY
      const pending = list.filter(
        (l: any) => (l.status || "").toLowerCase() === "approved"
      );

      console.log(LOG_PREFIX, "📥 Pending disbursement:", pending.length);

      setLoans(pending);
    } catch (err: any) {
      console.error(
        LOG_PREFIX,
        "❌ Load error:",
        err?.response?.data || err.message
      );
      Alert.alert("Error", "Unable to load pending disbursements.");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------
  // CONFIRM DISBURSE
  // -------------------------------------------
  const confirmDisburse = (loan: LoanRow) => {
    const amount =
      Number(loan.approved_principal) ||
      Number(loan.principal) ||
      0;

    Alert.alert(
      "Disburse Loan",
      `Disburse ₱ ${amount.toLocaleString()} to ${loan.full_name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "YES, DISBURSE", onPress: () => disburseLoan(loan.id) },
      ]
    );
  };

  // -------------------------------------------
  // DISBURSEMENT ACTION
  // -------------------------------------------
  const disburseLoan = async (loanId: string) => {
    setProcessingMap((p) => ({ ...p, [loanId]: true }));

    try {
      const headers = await getAuthHeaders();

      console.log(LOG_PREFIX, "➡️ Disbursing loan:", loanId);

      await axios.post(
        `${BASE_URL}/api/admin/disburse/${loanId}`,
        {},
        { headers }
      );

      Alert.alert("Success", "Loan disbursed successfully.");

      await loadPending();
    } catch (err: any) {
      console.error(
        LOG_PREFIX,
        "❌ Disburse error:",
        err?.response?.data || err.message
      );
      Alert.alert(
        "Error",
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Disbursement failed."
      );
    } finally {
      setProcessingMap((p) => ({ ...p, [loanId]: false }));
    }
  };

  // -------------------------------------------
  // IMAGE PREVIEW
  // -------------------------------------------
  const openPreview = (uri?: string | null) => {
    if (!uri) return;
    setPreviewUri(uri);
    setPreviewVisible(true);
  };

  // -------------------------------------------
  // RENDER LOAN CARD
  // -------------------------------------------
  const renderLoan = ({ item }: { item: LoanRow }) => {
    const approvedAmount =
      Number(item.approved_principal) ||
      Number(item.principal) ||
      0;

    const total =
      Number(item.approved_total_payable) ||
      Number(item.total_payable) ||
      0;

    return (
      <View style={styles.card}>
        {/* HEADER */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.full_name}</Text>

            <Text style={styles.meta}>
              Applied:{" "}
              {item.created_at
                ? format(new Date(item.created_at), "MMM d, yyyy")
                : "—"}
            </Text>

            <Text style={styles.meta}>
              Term: {item.days ?? "-"} days
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.amount}>
              ₱ {approvedAmount.toLocaleString()}
            </Text>
            <Text style={{ color: "#666", marginTop: 4 }}>
              Total: ₱ {total.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* DOCUMENTS */}
        <View style={styles.docRow}>
          <TouchableOpacity onPress={() => openPreview(item.gov_id_uri)}>
            <Image
              source={{
                uri:
                  item.gov_id_uri ||
                  "https://cdn-icons-png.flaticon.com/512/1096/1096781.png",
              }}
              style={styles.thumb}
            />
            <Text style={styles.thumbLabel}>ID</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => openPreview(item.selfie_id_uri)}>
            <Image
              source={{
                uri:
                  item.selfie_id_uri ||
                  "https://cdn-icons-png.flaticon.com/512/847/847969.png",
              }}
              style={styles.thumb}
            />
            <Text style={styles.thumbLabel}>Selfie</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => openPreview(item.proof_uri)}>
            <Image
              source={{
                uri:
                  item.proof_uri ||
                  "https://cdn-icons-png.flaticon.com/512/1828/1828817.png",
              }}
              style={styles.thumb}
            />
            <Text style={styles.thumbLabel}>Proof</Text>
          </TouchableOpacity>
        </View>

        {/* ACTIONS */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#0071b2" }]}
            onPress={() =>
              navigation.navigate("AdminLoanDetailsScreen", {
                loanId: item.id,
              })
            }
          >
            <Text style={styles.buttonText}>View Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#00C853" }]}
            onPress={() => confirmDisburse(item)}
            disabled={!!processingMap[item.id]}
          >
            {processingMap[item.id] ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Disburse</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // -------------------------------------------
  // SCREEN
  // -------------------------------------------
  return (
    <View style={{ flex: 1 }}>
      <SmallHeader title="Pending Disbursements" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : loans.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: "#666" }}>No loans waiting for disbursement.</Text>
        </View>
      ) : (
        <FlatList
          data={loans}
          renderItem={renderLoan}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        />
      )}

      {/* PREVIEW MODAL */}
      <Modal visible={previewVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={{ width: "100%", height: 600, resizeMode: "contain" }}
              />
            ) : (
              <Text style={{ color: "#fff" }}>No preview</Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setPreviewVisible(false)}
          >
            <Text style={{ fontWeight: "700" }}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// -------------------------------------------
// STYLES
// -------------------------------------------
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    elevation: 3,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  name: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 12, color: "#666", marginTop: 6 },

  amount: { fontSize: 18, fontWeight: "900", color: "#0071b2" },

  docRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  thumb: {
    width: 92,
    height: 62,
    borderRadius: 6,
    backgroundColor: "#f3f3f3",
  },

  thumbLabel: {
    textAlign: "center",
    marginTop: 6,
    fontSize: 12,
    color: "#555",
  },

  actions: {
    flexDirection: "row",
    marginTop: 12,
  },

  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 6,
  },

  buttonText: { color: "#fff", fontWeight: "700" },

  closeBtn: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    margin: 12,
  },
});
