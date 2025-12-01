// src/screens/AdminPaymentsScreen.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import PaymentFilterSheet from "../components/PaymentFilterSheet";

type Payment = {
  id: number;
  user_full_name?: string;
  user_email?: string;
  amount: number;
  payment_method?: string;
  type?: string;
  created_at: string;
};

export default function AdminPaymentsScreen({ navigation }: any) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);

  const [filterState, setFilterState] = useState({
    from: null as string | null,
    to: null as string | null,
    method: null as string | null,
    sort: "newest" as "newest" | "oldest" | "amount_desc" | "amount_asc",
  });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /** LOAD payments from backend */
  const loadPayments = async () => {
    try {
      setLoading(true);

      const params: any = {
        q: search || undefined,
        sort: filterState.sort,
      };

      if (filterState.from) params.from = filterState.from;
      if (filterState.to) params.to = filterState.to;
      if (filterState.method) params.method = filterState.method;

      const res = await api.get("/admin/all-payments", { params });

      setPayments(res.data.payments || []);
    } catch (err: any) {
      console.error("❌ Payment load error:", err?.response?.data || err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /** Reload when screen is focused */
  useFocusEffect(
    useCallback(() => {
      loadPayments();
    }, [search, filterState])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPayments();
  };

  /** PAYMENT CARD UI */
  const renderPayment = ({ item }: { item: Payment }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.user_full_name || "Unknown"}</Text>
          <Text style={styles.email}>{item.user_email || ""}</Text>

          <Text style={styles.meta}>
            {new Date(item.created_at).toLocaleString()}
          </Text>

          <Text style={styles.metaSmall}>
            Method: {item.payment_method || "-"}
          </Text>

          {item.type && (
            <Text style={styles.metaSmall}>Type: {item.type}</Text>
          )}
        </View>

        <Text style={styles.amount}>₱{item.amount.toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.openDrawer()}
          style={{ paddingRight: 12 }}
        >
          <Icon name="menu" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Payment Overview</Text>
      </View>

      {/* SEARCH + FILTER */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Icon
            name="search-outline"
            size={20}
            color="#666"
            style={{ marginLeft: 12 }}
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Search borrower or payment"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />

          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              style={{ paddingHorizontal: 8 }}
            >
              <Icon name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setFilterVisible(true)}
        >
          <Icon name="filter" size={20} color="#169AF9" />
        </TouchableOpacity>
      </View>

      {/* PAYMENT LIST */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#169AF9" />
        </View>
      ) : (
        <FlatList
          data={payments}
          renderItem={renderPayment}
          keyExtractor={(i) => String(i.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={() => (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Text>No payments found.</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      {/* FILTER SHEET */}
      <PaymentFilterSheet
        visible={filterVisible}
        initial={filterState}
        onRequestClose={() => setFilterVisible(false)}
        onApply={(f) => setFilterState(f)}
      />
    </View>
  );
}

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
  row: { flexDirection: "row", justifyContent: "space-between" },

  name: { fontSize: 16, fontWeight: "800", color: "#111" },
  email: { color: "#555", marginTop: 6 },

  meta: { color: "#666", marginTop: 6, fontSize: 13 },
  metaSmall: { color: "#999", marginTop: 4, fontSize: 12 },

  amount: {
    fontSize: 17,
    fontWeight: "900",
    color: "#169AF9",
    textAlign: "right",
  },
});
