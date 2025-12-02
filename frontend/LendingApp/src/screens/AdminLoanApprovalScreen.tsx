// src/screens/AdminLoanApprovalScreen.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { format } from "date-fns";
import { useFocusEffect } from "@react-navigation/native";
import SmallHeader from "../components/SmallHeader";
import api from "../services/api";

const PRIMARY = "#169AF9";      // KAURta Blue
const BG_LIGHT = "#F2F7FF";     // subtle light blue background

export default function AdminLoanApprovalScreen({ navigation }: any) {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<Record<number, boolean>>({});

  // --------------------------------------------------
  // Load Pending Loans
  // --------------------------------------------------
  const loadLoans = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/pending");
      setLoans(res.data || []);
    } catch (err) {
      console.log("❌ Pending loans load error:", err?.response?.data || err);
      Alert.alert("Error", "Unable to load pending loan applications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLoans();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadLoans();
  };

  // --------------------------------------------------
  // Reject Loan
  // --------------------------------------------------
  const rejectLoan = (loanId: number) => {
    Alert.alert(
      "Reject Loan",
      "Are you sure you want to reject this application?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessing((p) => ({ ...p, [loanId]: true }));
              await api.post(`/admin/reject/${loanId}`);
              setLoans((prev) => prev.filter((l) => l.id !== loanId));
              Alert.alert("Rejected", "Loan has been rejected.");
            } catch (err) {
              console.log("❌ Reject error:", err?.response?.data || err);
              Alert.alert("Error", "Failed to reject loan.");
            } finally {
              setProcessing((p) => ({ ...p, [loanId]: false }));
            }
          },
        },
      ]
    );
  };

  // --------------------------------------------------
  // Card Renderer
  // --------------------------------------------------
  const renderLoan = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.full_name}</Text>
        <Text style={styles.amount}>
          ₱ {Number(item.principal ?? 0).toLocaleString()}
        </Text>
      </View>

      <Text style={styles.purpose}>{item.purpose}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Term</Text>
        <Text style={styles.metaValue}>{item.days} days</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Applied</Text>
        <Text style={styles.metaValue}>
          {item.created_at
            ? format(new Date(item.created_at), "MMM d, yyyy")
            : "—"}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.reviewBtn]}
          onPress={() =>
            navigation.navigate("AdminLoanReviewScreen", {
              loanId: item.id,
            })
          }
        >
          <Text style={styles.actionText}>Review</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          disabled={processing[item.id]}
          onPress={() => rejectLoan(item.id)}
        >
          {processing[item.id] ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.actionText}>Reject</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // --------------------------------------------------
  // Loading Screen
  // --------------------------------------------------
  if (loading) {
    return (
      <View style={styles.container}>
        <SmallHeader title="Loan Approval" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  // --------------------------------------------------
  // Empty State Screen (fixed to use KAURta colors)
  // --------------------------------------------------
  if (loans.length === 0) {
    return (
      <View style={styles.container}>
        <SmallHeader title="Loan Approval" />

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending loans at this time.</Text>
        </View>
      </View>
    );
  }

  // --------------------------------------------------
  // MAIN CONTENT
  // --------------------------------------------------
  return (
    <View style={styles.container}>
      <SmallHeader title="Loan Approval" />

      <FlatList
        data={loans}
        renderItem={renderLoan}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

// =======================================================
// ⭐ KAURta UI Styles
// =======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  listContainer: {
    padding: 16,
    paddingBottom: 140,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  emptyText: {
    color: "#7289A3",
    fontSize: 15,
    textAlign: "center",
  },

  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#D6E8FF",
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0A2A43",
  },

  amount: {
    fontSize: 19,
    fontWeight: "800",
    color: PRIMARY,
  },

  purpose: {
    marginTop: 5,
    fontSize: 14,
    color: "#4A5D73",
    marginBottom: 12,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },

  metaLabel: {
    fontSize: 13,
    color: "#7289A3",
  },

  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A3C57",
  },

  actions: {
    flexDirection: "row",
    marginTop: 16,
  },

  actionBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 6,
  },

  reviewBtn: {
    backgroundColor: PRIMARY,
  },

  rejectBtn: {
    backgroundColor: "#FF4D4F",
  },

  actionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
});
