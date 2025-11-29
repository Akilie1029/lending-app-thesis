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
import { normalizeLoan } from "../utils/normalizeLoan";
import { BASE_URL } from "../config";

type LoanRow = {
  id: string;
  user_id?: string;
  full_name?: string;
  approved_amount?: number;
  principal?: number;
  total_payable?: number;
  remaining_balance?: number;
  days?: number | null;
  status?: string;
  created_at?: string;
  disbursed_at?: string | null;
  government_id_url?: string | null;
  selfie_with_id_url?: string | null;
  proof_of_funds_url?: string | null;
  [k: string]: any;
};

export default function AdminDisbursementScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [processingMap, setProcessingMap] = useState<Record<string, boolean>>(
    {}
  );

  // image preview modal
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem("userToken");
    return { Authorization: token ? `Bearer ${token}` : "" };
  };

  async function loadPending() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${BASE_URL}/api/admin/approved-loans`, {
        headers,
      });

      // ensure array
      const list = Array.isArray(res.data) ? res.data : res.data?.loans ?? [];
      const normalized = list.map((r: any) => normalizeLoan(r));
      // filter to loans that are waiting for disbursement (status we expect)
      const pending = normalized.filter(
        (l: any) =>
          (l.status || "").toLowerCase() === "approved" ||
          (l.status || "").toLowerCase() === "approved_pending_disburse" ||
          (l.status || "").toLowerCase() === "ready_to_disburse"
      );

      setLoans(pending);
    } catch (err: any) {
      console.error("Load pending disbursement error:", err?.response?.data || err?.message);
      Alert.alert("Error", "Failed to load pending disbursements.");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }

  const confirmDisburse = (loan: LoanRow) => {
    Alert.alert(
      "Disburse Loan",
      `Disburse ₱ ${Number(loan.approved_amount ?? loan.principal ?? 0).toLocaleString()} to ${loan.full_name ||
        "borrower"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disburse",
          onPress: () => disburseLoan(String(loan.id)),
        },
      ]
    );
  };

  const disburseLoan = async (loanId: string) => {
    setProcessingMap((p) => ({ ...p, [loanId]: true }));
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${BASE_URL}/api/admin/loan/${loanId}/disburse`,
        {},
        { headers }
      );

      // assume successful
      Alert.alert("Success", "Loan disbursed successfully.");
      // reload list
      await loadPending();
    } catch (err: any) {
      console.error("Disburse error:", err?.response?.data || err?.message);
      Alert.alert(
        "Error",
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to disburse loan."
      );
    } finally {
      setProcessingMap((p) => ({ ...p, [loanId]: false }));
    }
  };

  const openPreview = (uri?: string | null) => {
    if (!uri) return;
    setPreviewUri(uri);
    setPreviewVisible(true);
  };

  const renderLoan = ({ item }: { item: LoanRow }) => {
    const approved = Number(item.approved_amount ?? item.principal ?? 0);
    const total = Number(item.total_payable ?? 0);
    const term = item.days ?? "-";
    const id = String(item.id);

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.full_name || "Unknown borrower"}</Text>
            <Text style={styles.meta}>
              Applied:{" "}
              {item.created_at ? format(new Date(item.created_at), "MMM d, yyyy") : "—"}
            </Text>
            <Text style={styles.meta}>Term: {term} days</Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.amount}>₱ {approved.toLocaleString()}</Text>
            <Text style={{ color: "#666", marginTop: 6 }}>Total: ₱ {total.toLocaleString()}</Text>
          </View>
        </View>

        {/* Documents thumbnails */}
        <View style={styles.docRow}>
          <TouchableOpacity onPress={() => openPreview(item.government_id_url)}>
            <Image
              source={{
                uri:
                  item.government_id_url ||
                  item.government_id_local_uri ||
                  "https://cdn-icons-png.flaticon.com/512/1096/1096781.png",
              }}
              style={styles.thumb}
            />
            <Text style={styles.thumbLabel}>ID</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => openPreview(item.selfie_with_id_url)}>
            <Image
              source={{
                uri:
                  item.selfie_with_id_url ||
                  item.selfie_with_id_local_uri ||
                  "https://cdn-icons-png.flaticon.com/512/847/847969.png",
              }}
              style={styles.thumb}
            />
            <Text style={styles.thumbLabel}>Selfie</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => openPreview(item.proof_of_funds_url)}>
            <Image
              source={{
                uri:
                  item.proof_of_funds_url ||
                  item.proof_of_funds_local_uri ||
                  "https://cdn-icons-png.flaticon.com/512/1828/1828817.png",
              }}
              style={styles.thumb}
            />
            <Text style={styles.thumbLabel}>Proof</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#0071b2" }]}
            onPress={() => navigation.navigate("Loan Details", { loan: item })}
          >
            <Text style={styles.buttonText}>View Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#00C853" }]}
            onPress={() => confirmDisburse(item)}
            disabled={!!processingMap[id]}
          >
            {processingMap[id] ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Disburse Now</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          data={loans}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderLoan}
        />
      )}

      {/* Image preview modal */}
      <Modal visible={previewVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ alignItems: "center", padding: 16 }}>
              {previewUri ? (
                <Image
                  source={{ uri: previewUri }}
                  style={{ width: "100%", height: 520, resizeMode: "contain" }}
                />
              ) : (
                <Text style={{ color: "#fff" }}>No preview available</Text>
              )}
            </ScrollView>

            <View style={{ padding: 12 }}>
              <TouchableOpacity
                onPress={() => setPreviewVisible(false)}
                style={{
                  backgroundColor: "#fff",
                  padding: 12,
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "700" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    elevation: 3,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  name: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 12, color: "#666", marginTop: 6 },
  amount: { fontSize: 18, fontWeight: "900", color: "#0071b2" },

  docRow: { flexDirection: "row", marginTop: 12, justifyContent: "space-between" },
  thumb: { width: 92, height: 62, borderRadius: 6, backgroundColor: "#f3f3f3" },
  thumbLabel: { textAlign: "center", marginTop: 6, fontSize: 12, color: "#555" },

  actions: { flexDirection: "row", marginTop: 12 },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 6,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
