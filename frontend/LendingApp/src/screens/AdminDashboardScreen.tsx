// src/screens/AdminDashboardScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { BarChart, LineChart } from "react-native-chart-kit";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import AdminHeader from "../components/AdminHeader";
import RadialRing from "../components/RadialRing";
import adminDashboardService from "../services/adminDashboardService";

const { width } = Dimensions.get("window");
const CONTENT_PADDING = 12;
const PANEL_HORIZONTAL_PADDING = 16;
const BIG_CHART_WIDTH = Math.min(width - CONTENT_PADDING * 2 - 24, 920); // increased max so 12 bars can fit

export default function AdminDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigation = useNavigation<any>();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setStats(null);

      const ui = await adminDashboardService.getDashboardStats({ sparkPoints: 12, smoothing: true });
      setStats(ui);
    } catch (err) {
      console.error("Dashboard load failed:", err);
      setErrorMsg("Failed to load dashboard. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (stats) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [stats]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading dashboard...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#c00", fontWeight: "700" }}>{errorMsg}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadStats}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.center}>
        <Text>No dashboard data available.</Text>
      </View>
    );
  }

  // helper: format peso with sign first
  const fmtPeso = (n: number) => `₱ ${n.toLocaleString()}`;

  /* ------------------ UI ------------------ */
  return (
    <ScrollView style={styles.container}>
      <AdminHeader title="Admin Dashboard" />

      {/* Top stat cards */}
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
          <Text style={[styles.statValue, { color: "#fff" }]}>{stats.rejectedCount}</Text>
          <Text style={[styles.statFoot, { color: "#fff" }]}>Declined apps</Text>
        </View>
      </View>

      {/* Loan status radial rings */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Loan Status</Text>
        <View style={styles.ringRow}>
          <RadialRing
            progress={stats.ringPercent.paidPct}
            label="Paid"
            amount={stats.loanStatusDistribution.paidAmount}
            colors={{ start: "#19d06b", end: "#00c853" }}
          />
          <RadialRing
            progress={stats.ringPercent.unpaidPct}
            label="Unpaid"
            amount={stats.loanStatusDistribution.unpaidAmount}
            colors={{ start: "#4facfe", end: "#00c6fb" }}
          />
          <RadialRing
            progress={stats.ringPercent.overduePct}
            label="Overdue"
            amount={stats.loanStatusDistribution.overdueAmount}
            colors={{ start: "#ff6b6b", end: "#ff3b30" }}
          />
        </View>
      </View>

      {/* Payment Overview (4-week, expected vs actual) */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Overview (Last 4 Weeks)</Text>

        <LineChart
          data={stats.paymentsVsCollectiblesChart}
          width={BIG_CHART_WIDTH}
          height={160}
          withDots={false}
          withInnerLines={false} // remove grid
          withOuterLines={false}
          withVerticalLabels={true}
          withHorizontalLabels={true}
          yAxisSuffix="₱"
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
            labelColor: (opacity = 1) => `rgba(110,110,110,${opacity})`,
            strokeWidth: 2,
          }}
          bezier
          style={{ marginBottom: 12 }}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.legend, { color: "#0A74FF" }]}>🟦 Expected (Collectibles)</Text>
            <Text style={styles.amountText}>{fmtPeso(Math.round(stats.paymentsVsCollectiblesChart.datasets[0].data.reduce((a: number, b: number) => a + b, 0) / 4))}</Text>
          </View>

          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={[styles.legend, { color: "#00C853" }]}>🟩 Actual Payments</Text>
            <Text style={[styles.amountText, { color: "#00C853" }]}>{fmtPeso(Math.round(stats.paymentsVsCollectiblesChart.datasets[1].data.reduce((a: number, b: number) => a + b, 0) / 4))}</Text>
          </View>
        </View>
      </View>

      {/* Collections (7-day) */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Collections — Last 7 Days</Text>

        <BarChart
          data={stats.collectionsChart}
          width={BIG_CHART_WIDTH}
          height={170}
          fromZero
          withInnerLines={false} // no grid
          withOuterLines={false}
          yAxisSuffix="" // formatting will be done manually in labels
          yAxisInterval={2000}
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: (opacity = 1) => `rgba(10,132,255,${opacity})`,
            labelColor: (opacity = 1) => `rgba(110,110,110,${opacity})`,
          }}
          showValuesOnTopOfBars={false} // remove numbers on bars
          style={{ borderRadius: 8 }}
        />

        <View style={{ height: 8 }} />

        {/* explanatory row showing min/max Y axis */}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={[styles.legend, { fontSize: 12 }]}>₱ 0</Text>
          <Text style={[styles.legend, { fontSize: 12 }]}>₱ 2,000</Text>
          <Text style={[styles.legend, { fontSize: 12 }]}>₱ 4,000</Text>
          <Text style={[styles.legend, { fontSize: 12 }]}>₱ 6,000</Text>
          <Text style={[styles.legend, { fontSize: 12 }]}>₱ 8,000</Text>
          <Text style={[styles.legend, { fontSize: 12 }]}>₱ 10,000</Text>
        </View>
      </View>

      {/* Cashflow Overview (12-week) */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Cashflow Overview — Last 12 Weeks</Text>

        {/* BarChart for repayments vs disbursements */}
        <View style={{ position: "relative" }}>
          <BarChart
            data={stats.cashflowChart}
            width={BIG_CHART_WIDTH}
            height={200}
            fromZero
            withInnerLines={false}
            withOuterLines={false}
            chartConfig={{
              backgroundGradientFrom: "#fff",
              backgroundGradientTo: "#fff",
              color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
              labelColor: (opacity = 1) => `rgba(110,110,110,${opacity})`,
            }}
            showValuesOnTopOfBars={false}
            style={{ borderRadius: 8 }}
          />

          {/* Overlay net line using LineChart positioned absolutely */}
          <View style={{ position: "absolute", left: 0, top: 0 }}>
            <LineChart
              data={{
                labels: stats.cashflowChart.labels,
                datasets: [{ data: stats.raw12WeekRepayments.map((r: number, i: number) => r - (stats.raw12WeekDisbursements[i] || 0)) }],
              }}
              width={BIG_CHART_WIDTH}
              height={200}
              withDots={true}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLabels={false}
              withHorizontalLabels={false}
              chartConfig={{
                backgroundGradientFrom: "transparent",
                backgroundGradientTo: "transparent",
                color: (opacity = 1) => `rgba(34,34,34,${opacity})`,
                labelColor: () => `rgba(0,0,0,0)`,
              }}
              bezier
              style={{ backgroundColor: "transparent", marginLeft: 0 }}
            />
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={[styles.legend, { color: "#0A74FF" }]}>🔵 Repayments</Text>
          <Text style={[styles.legend, { color: "#FF3B30" }]}>🔴 Disbursements</Text>
          <Text style={[styles.legend, { color: "#222", marginTop: 4 }]}>— Net cashflow (line)</Text>
        </View>
      </View>

      {/* Payment Behavior (on-time vs late, 4 weeks) */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Behavior — On-Time vs Late (4 weeks)</Text>

        <BarChart
          data={stats.onTimeLateChart}
          width={Math.min(BIG_CHART_WIDTH, width - CONTENT_PADDING * 2 - 24)}
          height={180}
          fromZero
          withInnerLines={false}
          withOuterLines={false}
          chartConfig={{
            backgroundGradientFrom: "#fff",
            backgroundGradientTo: "#fff",
            color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
            labelColor: (opacity = 1) => `rgba(110,110,110,${opacity})`,
          }}
          showValuesOnTopOfBars={false}
          style={{ borderRadius: 8 }}
        />

        <View style={{ marginTop: 8 }}>
          <Text style={[styles.legend, { color: "#007AFF" }]}>🔵 On-time (count)</Text>
          <Text style={[styles.legend, { color: "#FF3B30" }]}>🔴 Late (count)</Text>
        </View>
      </View>

      {/* navigation badges */}
      <View style={{ marginTop: 12 }}>
        <TouchableOpacity style={styles.badgeButton} onPress={() => navigation.navigate("AdminLoanApprovalScreen")}>
          <Text style={styles.badgeText}>Pending Loan Approval</Text>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>{stats.pendingLoanApproval}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.badgeButton, { backgroundColor: "#ff3b30" }]} onPress={() => navigation.navigate("AdminDisbursementScreen")}>
          <Text style={[styles.badgeText, { color: "#fff" }]}>Pending Disbursement</Text>
          <View style={[styles.badgeCount, { backgroundColor: "#fff" }]}>
            <Text style={styles.badgeCountTextRed}>{stats.pendingDisbursement}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

/* --------------------- Styles ---------------------- */

const styles = StyleSheet.create({
  container: { backgroundColor: "#f3f6fa", padding: CONTENT_PADDING },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },

  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 6,
    elevation: 3,
  },
  statLabel: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0071b2", marginTop: 6 },
  statFoot: { marginTop: 6, fontSize: 11, color: "#9aa4b2" },

  rejectedCard: { backgroundColor: "#ff4d4d" },

  panel: { backgroundColor: "#fff", padding: 16, borderRadius: 14, marginTop: 18, elevation: 3 },

  panelTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 10 },

  ringRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  legend: { fontSize: 14, marginVertical: 2, fontWeight: "600", color: "#333" },

  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  amountText: { marginTop: 6, fontSize: 20, fontWeight: "900", color: "#0071b2" },

  badgeButton: {
    backgroundColor: "#FFC107",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  badgeText: { fontSize: 15, fontWeight: "700" },

  badgeCount: {
    backgroundColor: "#ff3b30",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  badgeCountText: { color: "#fff", fontWeight: "800" },
  badgeCountTextRed: { color: "#ff3b30", fontWeight: "800" },

  retryButton: {
    marginTop: 12,
    backgroundColor: "#0A9EFA",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },

  retryText: { color: "#fff", fontWeight: "700" },
});
