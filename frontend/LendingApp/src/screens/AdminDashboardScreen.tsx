// src/screens/AdminDashboardScreen.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import AdminHeader from "../components/AdminHeader";
import RadialRing from "../components/RadialRing";
import api from "../services/api";
import { LineChart, BarChart } from "react-native-chart-kit";

const screenWidth = Dimensions.get("window").width;
const CHART_WIDTH = screenWidth - 32;

export default function AdminDashboardScreen() {
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => {
    try {
      setLoading(true);

      // 🔥 FIX: USE CORRECT ENDPOINT
      const res = await api.get("/admin/dashboard-stats");

      console.log("📊 Dashboard Stats Response:", res.data);

      setStats(res.data || {});
    } catch (err) {
      console.log("Dashboard load error:", err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#169AF9" />
        <Text style={{ marginTop: 10 }}>Loading dashboard...</Text>
      </View>
    );
  }

  // 🔥 FIXED: match backend controller fields
  const paid = stats.loanStatusDistribution?.paidAmount ?? 0;
  const unpaid = stats.loanStatusDistribution?.unpaidAmount ?? 0;
  const overdue = stats.loanStatusDistribution?.overdueAmount ?? 0;

  const total = paid + unpaid + overdue;
  const pct = (v: number) => (total === 0 ? 0 : Math.round((v / total) * 100));

  return (
    <ScrollView style={styles.container}>
      <AdminHeader title="Admin Dashboard" />

      {/* TOP STATS */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Borrowers</Text>

          {/* backend: borrowerCount */}
          <Text style={styles.statValue}>{stats.borrowerCount ?? 0}</Text>

          <Text style={styles.statFoot}>Active users</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active Loans</Text>

          {/* backend: activeLoanCount */}
          <Text style={styles.statValue}>{stats.activeLoanCount ?? 0}</Text>

          <Text style={styles.statFoot}>Currently disbursed</Text>
        </View>

        <View style={[styles.statCard, styles.redCard]}>
          <Text style={[styles.statLabel, { color: "#fff" }]}>Rejected</Text>

          {/* backend: rejectedCount */}
          <Text style={[styles.statValue, { color: "#fff" }]}>
            {stats.rejectedCount ?? 0}
          </Text>
          <Text style={[styles.statFoot, { color: "#ffe" }]}>Declined</Text>
        </View>
      </View>

      {/* PENDING ACTIONS */}
      <View style={styles.pendingBox}>
        <TouchableOpacity
          style={styles.pendingYellow}
          onPress={() =>
            navigation.navigate("AdminLoanApprovalScreen" as never)
          }
        >
          <Text style={styles.pendingDark}>Pending Loan Approval</Text>
          <View style={styles.pendingCountYellow}>
            <Text style={styles.pendingNumDark}>
              {stats.pendingLoanApproval ?? 0}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pendingRed}
          onPress={() =>
            navigation.navigate("AdminDisbursementScreen" as never)
          }
        >
          <Text style={styles.pendingLight}>Pending Disbursement</Text>
          <View style={styles.pendingCountLight}>
            <Text style={styles.pendingNumRed}>
              {stats.pendingDisbursement ?? 0}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* STATUS RINGS */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Loan Status Breakdown</Text>

        <View style={styles.ringRow}>
          <RadialRing
            progress={pct(paid)}
            label="Paid"
            amount={paid}
            colors={{ start: "#19d06b", end: "#00c853" }}
          />
          <RadialRing
            progress={pct(unpaid)}
            label="Unpaid"
            amount={unpaid}
            colors={{ start: "#4facfe", end: "#00c6fb" }}
          />
          <RadialRing
            progress={pct(overdue)}
            label="Overdue"
            amount={overdue}
            colors={{ start: "#ff6b6b", end: "#ff3b30" }}
          />
        </View>
      </View>

      {/* 4-WEEK OVERVIEW */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Overview (Last 4 Weeks)</Text>

        <LineChart
          data={{
            labels: stats.paymentOverview4?.labels || [],
            datasets: [
              {
                data: stats.paymentOverview4?.expected || [],
                color: () => "#007AFF",
              },
              {
                data: stats.paymentOverview4?.actual || [],
                color: () => "#34C759",
              },
            ],
          }}
          width={CHART_WIDTH}
          height={220}
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: () => "#666",
            labelColor: () => "#777",
          }}
          bezier
          style={{ borderRadius: 12 }}
        />
      </View>

      {/* WEEKLY COLLECTIONS */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Collections (Last 7 Days)</Text>

        <BarChart
          data={{
            labels: stats.weeklyCollections?.labels || [],
            datasets: [
              {
                data: stats.weeklyCollections?.values || [],
              },
            ],
          }}
          width={CHART_WIDTH}
          height={220}
          fromZero
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: () => "#007AFF",
            labelColor: () => "#777",
          }}
          style={{ borderRadius: 12 }}
        />
      </View>

      {/* PAYMENT BEHAVIOR */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Behavior</Text>

        <BarChart
          data={{
            labels: stats.paymentBehavior?.labels || [],
            datasets: [
              {
                data: stats.paymentBehavior?.onTime || [],
                color: () => "#0A84FF",
              },
              {
                data: stats.paymentBehavior?.late || [],
                color: () => "#FF3B30",
              },
            ],
          }}
          width={CHART_WIDTH}
          height={220}
          fromZero
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: () => "#444",
            labelColor: () => "#666",
          }}
        />
      </View>

      {/* CASHFLOW */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Cashflow (12 Weeks)</Text>

        <LineChart
          data={{
            labels:
              stats.cashflow?.labels?.map((l: string, i: number) =>
                i % 2 === 0 ? l : ""
              ) || [],
            datasets: [
              { data: stats.cashflow?.repaid || [], color: () => "#0A84FF" },
              { data: stats.cashflow?.disbursed || [], color: () => "#FF3B30" },
            ],
          }}
          width={CHART_WIDTH}
          height={220}
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: () => "#333",
            labelColor: () => "#666",
          }}
          bezier
        />
      </View>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fa", padding: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  statsRow: { flexDirection: "row", justifyContent: "space-between" },

  statCard: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    elevation: 3,
  },

  statLabel: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0071b2" },
  statFoot: { fontSize: 11, marginTop: 6, color: "#9aa4b2" },

  redCard: { backgroundColor: "#ff4d4d" },

  pendingBox: { marginTop: 18 },

  pendingYellow: {
    backgroundColor: "#FFC107",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  pendingDark: { color: "#000", fontWeight: "700" },
  pendingCountYellow: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingNumDark: { color: "#fff", fontWeight: "800" },

  pendingRed: {
    backgroundColor: "#ff3b30",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pendingLight: { color: "#fff", fontWeight: "700" },
  pendingCountLight: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingNumRed: { color: "#ff3b30", fontWeight: "800" },

  panel: {
    marginTop: 18,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    elevation: 3,
  },

  panelTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },

  ringRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
