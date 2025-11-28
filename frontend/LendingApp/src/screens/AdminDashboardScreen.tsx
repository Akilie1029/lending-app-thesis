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
import { LineChart, BarChart } from "react-native-chart-kit";

import AdminHeader from "../components/AdminHeader";
import RadialRing from "../components/RadialRing";
import adminDashboardService from "../services/adminDashboardService";

const screenWidth = Dimensions.get("window").width;
const CHART_WIDTH = screenWidth - 32;

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  async function loadDashboard() {
    try {
      setLoading(true);
      const data = await adminDashboardService.load();
      setStats(data);
    } catch (err) {
      console.log("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0A84FF" />
        <Text style={{ marginTop: 10 }}>Loading dashboard...</Text>
      </View>
    );
  }

  const paid = stats.loanStatusDistribution.paidAmount ?? 0;
  const unpaid = stats.loanStatusDistribution.unpaidAmount ?? 0;
  const overdue = stats.loanStatusDistribution.overdueAmount ?? 0;

  const total = paid + unpaid + overdue;
  const pct = (value: number) =>
    total === 0 ? 0 : Math.round((value / total) * 100);

  return (
    <ScrollView style={styles.container}>
      <AdminHeader title="Admin Dashboard" />

      {/* TOP STATS */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Borrowers</Text>
          <Text style={styles.statValue}>{stats.borrowerCount}</Text>
          <Text style={styles.statFoot}>Active users</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active Loans</Text>
          <Text style={styles.statValue}>{stats.activeLoanCount}</Text>
          <Text style={styles.statFoot}>Currently disbursed</Text>
        </View>

        <View style={[styles.statCard, styles.rejectedCard]}>
          <Text style={[styles.statLabel, { color: "#fff" }]}>Rejected</Text>
          <Text style={[styles.statValue, { color: "#fff" }]}>
            {stats.rejectedCount}
          </Text>
          <Text style={[styles.statFoot, { color: "#ffe" }]}>Declined</Text>
        </View>
      </View>

      {/* PENDING ACTIONS */}
      <View style={styles.pendingContainer}>
        <TouchableOpacity
          style={styles.pendingYellow}
          onPress={() => navigation.navigate("AdminLoanApprovalScreen" as never)}
        >
          <Text style={styles.pendingTextDark}>Pending Loan Approval</Text>
          <View style={styles.pendingCountRed}>
            <Text style={styles.pendingNumberLight}>
              {stats.pendingLoanApproval}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pendingRed}
          onPress={() => navigation.navigate("AdminDisbursementScreen" as never)}
        >
          <Text style={styles.pendingTextLight}>Pending Disbursement</Text>
          <View style={styles.pendingCountLight}>
            <Text style={styles.pendingNumberRed}>
              {stats.pendingDisbursement}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* STATUS RINGS */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Loan Status</Text>

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
            labels: stats.paymentOverview4.labels,
            datasets: [
              { data: stats.paymentOverview4.expected, color: () => "#007AFF" },
              { data: stats.paymentOverview4.actual, color: () => "#34C759" },
            ],
            legend: ["Expected", "Actual"],
          }}
          width={CHART_WIDTH}
          height={220}
          yAxisSuffix="₱"
          withInnerLines={false}
          withOuterLines={false}
          chartConfig={{
            backgroundColor: "#fff",
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: () => "#444",
            labelColor: () => "#555",
          }}
          bezier
          style={{ borderRadius: 12 }}
        />
      </View>

      {/* WEEKLY COLLECTIONS */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Collections — Last 7 Days</Text>

        <BarChart
          data={{
            labels: stats.weeklyCollections.labels,
            datasets: [{ data: stats.weeklyCollections.values }],
          }}
          width={CHART_WIDTH}
          height={220}
          withInnerLines={false}
          withOuterLines={false}
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: () => "#007AFF",
            labelColor: () => "#666",
          }}
          style={{ borderRadius: 12 }}
        />
      </View>

      {/* PAYMENT BEHAVIOR */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Behavior — On-Time vs Late</Text>

        <BarChart
          data={{
            labels: stats.paymentBehavior.labels,
            datasets: [
              { data: stats.paymentBehavior.onTime, color: () => "#0A84FF" },
              { data: stats.paymentBehavior.late, color: () => "#FF3B30" },
            ],
            legend: ["On Time", "Late"],
          }}
          width={CHART_WIDTH}
          height={230}
          fromZero
          withInnerLines={false}
          withOuterLines={false}
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: () => "#444",
            labelColor: () => "#666",
          }}
          style={{ borderRadius: 12 }}
        />
      </View>

      {/* CASHFLOW */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Cashflow — Last 12 Weeks</Text>

        <LineChart
          data={{
            labels: stats.cashflow.labels.map((l: string, i: number) =>
              i % 2 === 0 ? l : ""
            ),
            datasets: [
              { data: stats.cashflow.repaid, color: () => "#0A84FF" },
              { data: stats.cashflow.disbursed, color: () => "#FF3B30" },
            ],
            legend: ["Repaid", "Disbursed"],
          }}
          width={CHART_WIDTH}
          height={220}
          withInnerLines={false}
          withOuterLines={false}
          yAxisSuffix="₱"
          chartConfig={{
            backgroundColor: "#fff",
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
  container: { flex: 1, padding: 12, backgroundColor: "#f3f6fa" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    marginHorizontal: 4,
    borderRadius: 12,
    elevation: 3,
  },
  statLabel: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0071b2", marginTop: 6 },
  statFoot: { fontSize: 11, color: "#9aa4b2", marginTop: 6 },

  rejectedCard: { backgroundColor: "#ff4d4d" },

  pendingContainer: { marginTop: 18 },
  pendingYellow: {
    backgroundColor: "#FFC107",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  pendingRed: {
    backgroundColor: "#ff3b30",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pendingTextDark: { fontSize: 15, fontWeight: "700", color: "#000" },
  pendingTextLight: { fontSize: 15, fontWeight: "700", color: "#fff" },
  pendingCountRed: {
    backgroundColor: "#ff3b30",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pendingCountLight: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pendingNumberLight: { color: "#fff", fontWeight: "800" },
  pendingNumberRed: { color: "#ff3b30", fontWeight: "800" },

  panel: { backgroundColor: "#fff", padding: 16, borderRadius: 14, marginTop: 20, elevation: 3 },
  panelTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },

  ringRow: { flexDirection: "row", justifyContent: "space-between" },

  legend: { fontSize: 14, fontWeight: "600", marginVertical: 2 },
});
