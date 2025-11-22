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

  /* -------------------------------------------------------------
   * Derived data
   * ------------------------------------------------------------- */

  const ringTotal =
    stats.loanStatusDistribution.paidAmount +
    stats.loanStatusDistribution.unpaidAmount +
    stats.loanStatusDistribution.overdueAmount;

  const pct = (v: number) =>
    ringTotal === 0 ? 0 : Math.round((v / ringTotal) * 100);

  return (
    <ScrollView style={styles.container}>
      <AdminHeader title="Admin Dashboard" />

      {/* ====================== TOP STATS ====================== */}
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
          <Text style={[styles.statFoot, { color: "#ffe" }]}>
            Declined apps
          </Text>
        </View>
      </View>

      {/* ====================== PENDING ACTIONS (Option C) ====================== */}
      <View style={styles.pendingContainer}>
        <TouchableOpacity
          style={styles.pendingYellow}
          onPress={() => navigation.navigate("AdminLoanApprovalScreen")}
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
          onPress={() => navigation.navigate("AdminDisbursementScreen")}
        >
          <Text style={styles.pendingTextLight}>Pending Disbursement</Text>
          <View style={styles.pendingCountLight}>
            <Text style={styles.pendingNumberRed}>
              {stats.pendingDisbursement}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ====================== RADIAL RINGS ====================== */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Loan Status</Text>

        <View style={styles.ringRow}>
          <RadialRing
            progress={pct(stats.loanStatusDistribution.paidAmount)}
            label="Paid"
            amount={stats.loanStatusDistribution.paidAmount}
            colors={{ start: "#19d06b", end: "#00c853" }}
          />

          <RadialRing
            progress={pct(stats.loanStatusDistribution.unpaidAmount)}
            label="Unpaid"
            amount={stats.loanStatusDistribution.unpaidAmount}
            colors={{ start: "#4facfe", end: "#00c6fb" }}
          />

          <RadialRing
            progress={pct(stats.loanStatusDistribution.overdueAmount)}
            label="Overdue"
            amount={stats.loanStatusDistribution.overdueAmount}
            colors={{ start: "#ff6b6b", end: "#ff3b30" }}
          />
        </View>
      </View>

      {/* ====================== PAYMENT OVERVIEW — 4 WEEKS ====================== */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Overview (Last 4 Weeks)</Text>

        <LineChart
          data={{
            labels: stats.paymentOverview4.labels,
            datasets: [
              {
                data: stats.paymentOverview4.expected,
                color: () => "rgba(0,122,255,1)", // blue
              },
              {
                data: stats.paymentOverview4.actual,
                color: () => "rgba(52,199,89,1)", // green
              },
            ],
            legend: ["Collectibles (Expected)", "Payments (Actual)"],
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

        <View style={{ marginTop: 10 }}>
          <Text style={styles.legend}>
            🟦 Collectibles — ₱{" "}
            {stats.paymentOverview4.expected
              .reduce((a: number, b: number) => a + b, 0)
              .toLocaleString()}
          </Text>

          <Text style={styles.legend}>
            🟩 Payments — ₱{" "}
            {stats.paymentOverview4.actual
              .reduce((a: number, b: number) => a + b, 0)
              .toLocaleString()}
          </Text>
        </View>
      </View>

      {/* ====================== WEEKLY COLLECTIONS ====================== */}
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
          showValuesOnTopOfBars={false}
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: () => "rgba(0,122,255,1)",
            labelColor: () => "#666",
          }}
          style={{ borderRadius: 12 }}
        />
      </View>

      {/* ====================== PAYMENT BEHAVIOR ====================== */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Behavior — On-Time vs Late</Text>

        <BarChart
          data={{
            labels: stats.paymentBehavior.labels,
            datasets: [
              {
                data: stats.paymentBehavior.onTime,
                color: () => "#0A84FF", // blue
              },
              {
                data: stats.paymentBehavior.late,
                color: () => "#FF3B30", // red
              },
            ],
            legend: ["On-Time", "Late"],
          }}
          width={CHART_WIDTH}
          height={240}
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

      {/* ====================== CASHFLOW — 12 WEEKS ====================== */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Cashflow — Last 12 Weeks</Text>

        <LineChart
          data={{
            labels: stats.cashflow.labels.map((l: string, i: number) =>
              i % 2 === 0 ? l : "" // show every 2nd label
            ),
            datasets: [
              { data: stats.cashflow.repaid, color: () => "#0A84FF" },
              { data: stats.cashflow.disbursed, color: () => "#FF3B30" },
            ],
            legend: ["Repayments", "Disbursements"],
          }}
          width={CHART_WIDTH}
          height={230}
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

      {/* Spacer */}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

/* ====================================================================
 * STYLES
 * ==================================================================== */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: "#f3f6fa",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    marginHorizontal: 4,
    borderRadius: 12,
    elevation: 3,
  },

  statLabel: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
  },

  statValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0071b2",
    marginTop: 6,
  },

  statFoot: {
    marginTop: 6,
    fontSize: 11,
    color: "#9aa4b2",
  },

  rejectedCard: {
    backgroundColor: "#ff4d4d",
  },

  pendingContainer: {
    marginTop: 18,
  },

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

  pendingTextDark: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },

  pendingTextLight: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

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

  pendingNumberLight: {
    color: "#fff",
    fontWeight: "800",
  },

  pendingNumberRed: {
    color: "#ff3b30",
    fontWeight: "800",
  },

  panel: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginTop: 20,
    elevation: 3,
  },

  panelTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
  },

  ringRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  legend: {
    fontSize: 14,
    color: "#333",
    marginVertical: 2,
    fontWeight: "600",
  },
});
