import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import SmallHeader from "../components/SmallHeader";
import { normalizeLoan } from "../utils/normalizeLoan";
import { BASE_URL } from "../config";
import { format } from "date-fns";

type LoanRow = {
  id: string;
  full_name?: string;
  approved_amount?: number;
  principal?: number;
  total_payable?: number;
  remaining_balance?: number;
  status?: string;
  disbursed_at?: string | null;
  created_at?: string;
  [k: string]: any;
};

export default function AdminApprovedLoansScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    loadLoans();
  }, []);

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem("userToken");
    return { Authorization: token ? `Bearer ${token}` : "" };
  };

  async function loadLoans() {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${BASE_URL}/api/admin/approved-loans`, {
        headers,
      });

      const list = Array.isArray(res.data) ? res.data : res.data?.loans ?? [];
      const normalized = list.map((r: any) => normalizeLoan(r));
      // Show those that have been approved or disbursed (active/completed)
      const filtered = normalized.filter((l: any) =>
        ["active", "paid", "completed", "disbursed"].includes(
          (l.status || "").toLowerCase()
        )
      );

      setLoans(filtered);
    } catch (err: any) {
      console.error("Load approved loans error:", err?.response?.data || err?.message);
      Alert.alert("Error", "Unable to load approved loans.");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredLoans = loans.filter((l) => {
    if (filter === "all") return true;
    if (filter === "active") return (l.status || "").toLowerCase() === "active";
    if (filter === "completed") return ["paid", "completed"].includes((l.status || "").toLowerCase());
    return true;
  });

  const renderRow = ({ item }: { item: LoanRow }) => {
    const approved = Number(item.approved_amount ?? item.principal ?? 0);
    const total = Number(item.total_payable ?? 0);
    const remaining = Number(item.remaining_balance ?? 0);
    const status = (item.status || "unknown").toUpperCase();

    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.name}>{item.full_name || "Unknown borrower"}</Text>
            <Text style={styles.meta}>
              Disbursed: {item.disbursed_at ? format(new Date(item.disbursed_at), "MMM d, yyyy") : "—"}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.amount}>₱ {approved.toLocaleString()}</Text>
            <Text style={{ color: "#666", marginTop: 6 }}>{status}</Text>
          </View>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={{ color: "#444" }}>Total Payable: ₱ {total.toLocaleString()}</Text>
          <Text style={{ color: "#444", marginTop: 6 }}>Remaining: ₱ {remaining.toLocaleString()}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#0071b2" }]}
            onPress={() => navigation.navigate("Loan Details", { loan: item })}
          >
            <Text style={styles.buttonText}>View Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#0A84FF" }]}
            onPress={() => {
              Alert.alert("Action", "No additional actions implemented yet.");
            }}
          >
            <Text style={styles.buttonText}>More</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <SmallHeader title="Approved / Disbursed Loans" />

      <View style={styles.filterRow}>
        <TouchableOpacity onPress={() => setFilter("all")} style={[styles.filterBtn, filter === "all" && styles.filterActive]}>
          <Text style={filter === "all" ? styles.filterTextActive : styles.filterText}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilter("active")} style={[styles.filterBtn, filter === "active" && styles.filterActive]}>
          <Text style={filter === "active" ? styles.filterTextActive : styles.filterText}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFilter("completed")} style={[styles.filterBtn, filter === "completed" && styles.filterActive]}>
          <Text style={filter === "completed" ? styles.filterTextActive : styles.filterText}>Completed</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredLoans}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderRow}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: "#666" }}>No approved/disbursed loans found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  filterRow: { flexDirection: "row", padding: 12, justifyContent: "space-around" },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6eef9",
  },
  filterActive: { backgroundColor: "#169AF9", borderColor: "#169AF9" },
  filterText: { color: "#333", fontWeight: "600" },
  filterTextActive: { color: "#fff", fontWeight: "700" },

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

  actions: { flexDirection: "row", marginTop: 12 },
  button: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", marginHorizontal: 6 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
