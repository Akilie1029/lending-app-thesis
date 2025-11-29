// src/screens/AdminAllLoansScreen.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import SmallHeader from "../components/SmallHeader";
import { normalizeLoan } from "../utils/normalizeLoan";
import { BASE_URL } from "../config";
import { format } from "date-fns";

const FILTERS = ["All", "Pending", "Approved", "Active", "Paid", "Rejected"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminAllLoansScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  useEffect(() => {
    loadAllLoans();
  }, []);

  const loadAllLoans = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await axios.get(`${BASE_URL}/api/admin/all-loans`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list = Array.isArray(res.data?.loans) ? res.data.loans : [];
      const normalized = list.map((l: any) => normalizeLoan(l));

      // newest first (already sorted in backend, but safe)
      normalized.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setLoans(normalized);
    } catch (err: any) {
      console.error("Load all loans error:", err?.response?.data || err?.message);
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------
               // FILTERING LOGIC
  // -------------------------------------------------------

  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const status = (loan.status || "").toLowerCase();
      const nameMatch = loan.full_name?.toLowerCase().includes(search.toLowerCase());
      const idMatch = String(loan.id).includes(search);

      // search match
      if (search && !nameMatch && !idMatch) return false;

      // filter match
      switch (filter) {
        case "Pending":
          return status === "pending";
        case "Approved":
          return (
            status === "approved" ||
            status === "approved_pending_disburse" ||
            status === "ready_to_disburse"
          );
        case "Active":
          return status === "active";
        case "Paid":
          return status === "paid" || status === "completed";
        case "Rejected":
          return status === "rejected";
        default:
          return true;
      }
    });
  }, [loans, search, filter]);

  // -------------------------------------------------------
               // RENDER ITEM
  // -------------------------------------------------------

  const renderLoan = ({ item }: { item: any }) => {
    const principal = Number(item.approved_amount ?? item.principal ?? 0);
    const created = item.created_at
      ? format(new Date(item.created_at), "MMM d, yyyy")
      : "—";

    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.name}>{item.full_name || "Unknown"}</Text>
            <Text style={styles.date}>Applied: {created}</Text>
            <Text style={styles.status}>Status: {item.status}</Text>
          </View>

          <Text style={styles.amount}>₱ {principal.toLocaleString()}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => navigation.navigate("Loan Details", { loan: item })}
          >
            <Text style={styles.detailsText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // -------------------------------------------------------
               // MAIN RENDER
  // -------------------------------------------------------

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <SmallHeader title="All Loans Overview" />

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search borrower or loan ID"
          style={styles.searchInput}
        />
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
          >
            <Text style={filter === f ? styles.filterTextActive : styles.filterText}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#169AF9" />
        </View>
      ) : (
        <FlatList
          data={filteredLoans}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLoan}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: "#666" }}>No loans found.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#d8e3f0",
  },

  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6eef9",
  },
  filterActive: {
    backgroundColor: "#169AF9",
    borderColor: "#169AF9",
  },
  filterText: { color: "#333", fontWeight: "600" },
  filterTextActive: { color: "#fff", fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
    elevation: 3,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  name: { fontSize: 16, fontWeight: "800" },
  date: { fontSize: 12, color: "#666", marginTop: 4 },
  status: { marginTop: 4, fontSize: 13, fontWeight: "700", color: "#169AF9" },
  amount: { fontSize: 18, fontWeight: "900", color: "#0071b2" },

  actions: { flexDirection: "row", marginTop: 10 },
  detailsBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#169AF9",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  detailsText: { color: "#169AF9", fontWeight: "700" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
