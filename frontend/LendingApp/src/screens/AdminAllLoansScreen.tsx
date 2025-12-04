// src/screens/AdminAllLoansScreen.tsx

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import LoanFilterSheet, { STATUS_OPTIONS } from "../components/LoanFilterSheet";

// --------------------------------------------
// STATUS COLOR + LABEL MAP (NEW)
// --------------------------------------------
const STATUS_LABELS: Record<string, string> = {
  pending: "PENDING",
  approved: "APPROVED",
  approved_pending_disburse: "APPROVED (Awaiting Borrower)",
  active: "ACTIVE",
  paid: "PAID",
  rejected: "REJECTED (Admin)",
  borrower_rejected: "REJECTED (Borrower)",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#FFC107",
  approved: "#169AF9",
  approved_pending_disburse: "#D67F00",
  active: "#19d06b",
  paid: "#7b61ff",
  rejected: "#ff4d4d",
  borrower_rejected: "#CC0000",
};

// --------------------------------------------
type LoanItem = {
  id: number | string;
  user_full_name?: string;
  user_id?: number | string;
  amount?: number;
  status?: string;
  created_at?: string;
};
// --------------------------------------------

export default function AdminAllLoansScreen({ navigation }: any) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);

  const [filterState, setFilterState] = useState<any>({
    from: null,
    to: null,
    statuses: null,
    sort: "newest",
  });

  // --------------------------------------------
  // FETCH LOANS
  // --------------------------------------------
  const loadLoans = async (p = 1, replace = true) => {
    try {
      setLoading(true);

      const params: any = {
        q: search || undefined,
        page: p,
        limit,
        sort: filterState.sort || undefined,
      };

      if (filterState.from) params.from = filterState.from;
      if (filterState.to) params.to = filterState.to;
      if (filterState.statuses && filterState.statuses.length > 0) {
        params.status = filterState.statuses.join(",");
      }

      console.log("📡 AdminAllLoans: Fetching loans →", params);

      const res = await api.get("/admin/all-loans", { params });

      setTotal(res.data.count || 0);

      if (replace) setLoans(res.data.loans || []);
      else setLoans((prev) => [...prev, ...(res.data.loans || [])]);

      setPage(p);
    } catch (err) {
      console.error("❌ Load loans error:", err?.response?.data || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLoans(1, true);
    }, [filterState, search])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadLoans(1, true);
  };

  const loadMore = () => {
    if (loans.length >= total) return;
    loadLoans(page + 1, false);
  };

  const openFilters = () => setFilterVisible(true);
  const closeFilters = () => setFilterVisible(false);

  const onApplyFilters = (f: any) => {
    setFilterState({
      ...filterState,
      ...f,
    });
  };

  const clearSearch = () => setSearch("");

  // --------------------------------------------
  // RENDER LOAN ROW
  // --------------------------------------------
  const renderLoan = ({ item }: { item: LoanItem }) => {
    const statusRaw = (item.status || "").toLowerCase();
    const displayLabel = STATUS_LABELS[statusRaw] || item.status?.toUpperCase() || "UNKNOWN";
    const color = STATUS_COLORS[statusRaw] || "#777";

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          navigation.navigate("AdminLoanReviewScreen", { loanId: item.id });
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {/* LEFT SIDE */}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.user_full_name || "Unknown Borrower"}</Text>
            <Text style={styles.meta}>Loan ID: {item.id}</Text>

            <Text style={styles.metaSmall}>
              Borrower ID: {item.user_id ?? "-"} •{" "}
              {item.created_at
                ? new Date(item.created_at).toLocaleDateString()
                : "-"}
            </Text>
          </View>

          {/* RIGHT SIDE */}
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.amount}>₱{(item.amount || 0).toFixed(2)}</Text>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: `${color}22`,
                  borderColor: `${color}44`,
                },
              ]}
            >
              <Text style={[styles.statusText, { color }]}>{displayLabel}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // --------------------------------------------
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ paddingRight: 12 }}>
          <Icon name="menu" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>All Loans</Text>
      </View>

      {/* SEARCH + FILTER */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Icon name="search-outline" size={20} color="#666" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search borrower or loan ID"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={() => loadLoans(1, true)}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={{ paddingHorizontal: 8 }}>
              <Icon name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.filterBtn} onPress={openFilters}>
          <Icon name="filter" size={20} color="#169AF9" />
        </TouchableOpacity>
      </View>

      {/* TOTALS */}
      <View style={styles.totalsRow}>
        <Text style={styles.totalsText}>
          Showing {loans.length} of {total} loans
        </Text>
      </View>

      {/* LIST */}
      {loading && loans.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#169AF9" />
        </View>
      ) : (
        <FlatList
          data={loans}
          renderItem={renderLoan}
          keyExtractor={(i) => String(i.id)}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#169AF9" />}
          ListEmptyComponent={() => (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Text>No loans found.</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      {/* FILTER SHEET */}
      <LoanFilterSheet
        visible={filterVisible}
        initial={{
          from: filterState.from,
          to: filterState.to,
          statuses: filterState.statuses,
          sort: filterState.sort,
        }}
        onRequestClose={closeFilters}
        onApply={onApplyFilters}
      />
    </View>
  );
}

// --------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fa" },

  header: {
    backgroundColor: "#169AF9",
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  searchRow: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
  },
  searchWrap: {
    flex: 1,
    backgroundColor: "#fff",
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8eef6",
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 15,
    color: "#333",
  },

  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8eef6",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },

  totalsRow: { paddingHorizontal: 12, paddingBottom: 6 },
  totalsText: { color: "#444", fontWeight: "700" },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 14,
    borderRadius: 12,
    elevation: 2,
    borderColor: "#eef2f6",
    borderWidth: 1,
  },
  name: { fontSize: 16, fontWeight: "800", color: "#111" },
  meta: { color: "#666", marginTop: 6 },
  metaSmall: { color: "#999", marginTop: 6, fontSize: 12 },
  amount: { color: "#0071b2", fontWeight: "900", fontSize: 16 },

  statusBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontWeight: "800", fontSize: 11 },
});

export default AdminAllLoansScreen;
