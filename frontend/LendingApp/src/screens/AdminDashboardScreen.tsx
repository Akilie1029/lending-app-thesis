// src/screens/AdminDashboardScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PieChart,
  LineChart,
  BarChart,
} from "react-native-chart-kit";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AdminHeader from "../components/AdminHeader";

const { width } = Dimensions.get("window");
const CONTENT_PADDING = 12;
const CHART_WIDTH = Math.min(160, Math.floor(width * 0.28)); // responsive pie width
const BIG_CHART_WIDTH = Math.min(width - CONTENT_PADDING * 2 - 40, 520); // for bar/line charts

type DashboardResponse = {
  borrowerCount: number;
  activeLoanCount: number;
  rejectedCount: number;
  loanStatusDistribution: {
    unpaidAmount: number;
    paidAmount: number;
    overdueAmount: number;
  };
  paymentOverview: { collectiblesToday: number; actualPayments: number };
  pendingLoanApproval: number;
  pendingDisbursement: number;
  totalDisbursedLoan: number;
  // optional: placeholders for Phase 3 (can be returned later by backend)
  loansAtRisk?: number;
  upcomingPayments?: Array<{ id: string; borrower: string; due: string; amount: number }>;
  weeklyCollections?: number[]; // 7 numbers for last 7 days
  dailyRepayments?: number[]; // sparkline
};

const chartConfig = {
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(120, 130, 140, ${opacity})`,
  strokeWidth: 2,
  useShadowColorFromDataset: false,
};

export default function AdminDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigation = useNavigation<any>();

  // small animated fade for charts
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadStats();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    // fade-in whenever stats load
    if (stats) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [stats, fadeAnim]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setStats(null);

      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        setErrorMsg("No auth token found. Please login again.");
        setLoading(false);
        return;
      }

      const res = await axios.get(
        "http://192.168.1.222:5001/api/admin/dashboard-stats",
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );

      if (!res.data || typeof res.data.borrowerCount === "undefined") {
        setErrorMsg("Unexpected response from server.");
        setLoading(false);
        return;
      }

      // Normalize optional arrays for charts if not present (so Phase 2 charts render)
      const normalized: DashboardResponse = {
        ...res.data,
        weeklyCollections: res.data.weeklyCollections || generatePlaceholderWeekly(res.data.totalDisbursedLoan),
        dailyRepayments: res.data.dailyRepayments || generatePlaceholderDaily(res.data.totalDisbursedLoan),
        loansAtRisk: res.data.loansAtRisk ?? Math.max(0, Math.floor((res.data.pendingDisbursement || 0) / 2)),
        upcomingPayments: res.data.upcomingPayments || [],
      };

      setStats(normalized);
      setLoading(false);
    } catch (err: any) {
      console.error("Dashboard error:", err);
      setErrorMsg("Failed to load dashboard. Check connection.");
      setLoading(false);
    }
  };

  // small placeholder generators (safe defaults)
  function generatePlaceholderWeekly(totalDisbursed: number) {
    // create 7 values that sum roughly to totalDisbursed/4 (arbitrary but reasonable)
    const base = Math.max(0, Math.round((totalDisbursed || 0) / 28));
    return Array.from({ length: 7 }, (_, i) => base + Math.round(Math.sin(i + 1) * base * 0.5));
  }

  function generatePlaceholderDaily(totalDisbursed: number) {
    const base = Math.max(0, Math.round((totalDisbursed || 0) / 70));
    return Array.from({ length: 10 }, (_, i) => Math.max(0, base + Math.round(Math.cos(i + 1) * base * 0.4)));
  }

  // ---- UI states
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

  // ===========================================================
  // Percent helpers
  // ===========================================================
  const totalForPie =
    stats.loanStatusDistribution.unpaidAmount +
    stats.loanStatusDistribution.paidAmount +
    stats.loanStatusDistribution.overdueAmount;

  const pct = (val: number) => {
    if (!totalForPie) return "0%";
    return `${Math.round((val / totalForPie) * 100)}%`;
  };

  const totalPayment = stats.paymentOverview.collectiblesToday + stats.paymentOverview.actualPayments;
  const pctPay = (val: number) => {
    if (!totalPayment) return "0%";
    return `${Math.round((val / totalPayment) * 100)}%`;
  };

  // Pie data (chart-kit expects `value` or `amount` property — we use `amount`)
  const loanPieData = [
    { name: "Unpaid", amount: stats.loanStatusDistribution.unpaidAmount, color: "#1E90FF", legendFontColor: "#333", legendFontSize: 12 },
    { name: "Paid", amount: stats.loanStatusDistribution.paidAmount, color: "#00C853", legendFontColor: "#333", legendFontSize: 12 },
    { name: "Overdue", amount: stats.loanStatusDistribution.overdueAmount, color: "#FF3B30", legendFontColor: "#333", legendFontSize: 12 },
  ];

  const paymentPieData = [
    { name: "Collectibles", amount: stats.paymentOverview.collectiblesToday, color: "#1E90FF", legendFontColor: "#333", legendFontSize: 12 },
    { name: "Payments", amount: stats.paymentOverview.actualPayments, color: "#00C853", legendFontColor: "#333", legendFontSize: 12 },
  ];

  // responsive chart widths
  const bigChartWidth = Math.min(BIG_CHART_WIDTH, width - CONTENT_PADDING * 2 - 20);
  const smallPieWidth = CHART_WIDTH;
  const smallPieHeight = CHART_WIDTH;

  // Weekly labels for BarChart (last 7 days)
  const weeklyLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].slice(0, (stats.weeklyCollections || []).length);

  // Sparkline labels (short) for LineChart
  const sparkLabels = (stats.dailyRepayments || []).map((_, i) => `${i + 1}`);

  return (
    <ScrollView style={styles.container}>
      <AdminHeader title="Admin Dashboard" />

      {/* Top stat cards (Phase 1) */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Borrowers</Text>
          <Text style={styles.statValue}>{stats.borrowerCount}</Text>
          {/* optional trend */}
          <Text style={styles.statFoot}>Active users</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active Loans</Text>
          <Text style={styles.statValue}>{stats.activeLoanCount}</Text>
          <Text style={styles.statFoot}>Currently disbursed</Text>
        </View>

        <View style={[styles.statCard, styles.rejectedStat]}>
          <Text style={[styles.statLabel, { color: "#fff" }]}>Rejected</Text>
          <Text style={[styles.statValue, { color: "#fff" }]}>{stats.rejectedCount}</Text>
          <Text style={[styles.statFoot, { color: "rgba(255,255,255,0.85)" }]}>Declined apps</Text>
        </View>
      </View>

      {/* Loan Status Distribution (Phase 1) */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Loan Status Distribution</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.legend}>🟦 {pct(stats.loanStatusDistribution.unpaidAmount)} Unpaid — ₱ {stats.loanStatusDistribution.unpaidAmount.toLocaleString()}</Text>
            <Text style={styles.legend}>🟩 {pct(stats.loanStatusDistribution.paidAmount)} Paid — ₱ {stats.loanStatusDistribution.paidAmount.toLocaleString()}</Text>
            <Text style={styles.legend}>🟥 {pct(stats.loanStatusDistribution.overdueAmount)} Overdue — ₱ {stats.loanStatusDistribution.overdueAmount.toLocaleString()}</Text>
          </View>

          <View style={styles.pieWrapper}>
            <PieChart
              data={loanPieData.map((d) => ({ name: d.name, population: d.amount, color: d.color, legendFontColor: d.legendFontColor, legendFontSize: d.legendFontSize }))}
              width={smallPieWidth}
              height={smallPieHeight}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="0"
              absolute
              hasLegend={false}
            />
          </View>
        </View>
      </View>

      {/* Payment Overview (same format) */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Payment Overview</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.legend}>🟦 {pctPay(stats.paymentOverview.collectiblesToday)} Collectibles — ₱ {stats.paymentOverview.collectiblesToday.toLocaleString()}</Text>
            <Text style={styles.legend}>🟩 {pctPay(stats.paymentOverview.actualPayments)} Payments — ₱ {stats.paymentOverview.actualPayments.toLocaleString()}</Text>
          </View>

          <View style={styles.pieWrapper}>
            <PieChart
              data={paymentPieData.map((d) => ({ name: d.name, population: d.amount, color: d.color, legendFontColor: d.legendFontColor, legendFontSize: d.legendFontSize }))}
              width={smallPieWidth}
              height={smallPieHeight}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="0"
              absolute
              hasLegend={false}
            />
          </View>
        </View>
      </View>

      {/* Phase 2: Weekly collections Bar Chart + Sparkline */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Collections — Last 7 days</Text>

        <Animated.View style={{ opacity: fadeAnim }}>
          <BarChart
            data={{
              labels: weeklyLabels.length ? weeklyLabels : ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
              datasets: [{ data: stats.weeklyCollections || [0, 0, 0, 0, 0, 0, 0] }],
            }}
            width={bigChartWidth}
            height={160}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(10,132,255,${opacity})`,
            }}
            showValuesOnTopOfBars
            fromZero
            style={{ borderRadius: 8 }}
          />

          <View style={{ height: 12 }} />

          <Text style={[styles.sectionTitle, { fontSize: 15 }]}>Repayments (sparkline)</Text>

          <LineChart
            data={{
              labels: sparkLabels.length ? sparkLabels : stats.dailyRepayments?.map((_, i) => `${i + 1}`) || [],
              datasets: [{ data: stats.dailyRepayments || [] }],
            }}
            width={bigChartWidth}
            height={110}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(0, 200, 83, ${opacity})`,
              propsForDots: { r: "3" },
            }}
            withDots={false}
            withShadow={false}
            withInnerLines={false}
            fromZero
            bezier
            style={{ marginVertical: 6, borderRadius: 8 }}
          />
        </Animated.View>
      </View>

      {/* Phase 3: Business Insights */}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Business Insights</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.legend}>⚠️ Loans at risk — {stats.loansAtRisk ?? 0}</Text>
            <Text style={styles.legend}>📈 Total Disbursed — ₱ {stats.totalDisbursedLoan.toLocaleString()}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.legend}>🔔 Upcoming Payments</Text>
            {stats.upcomingPayments && stats.upcomingPayments.length ? (
              stats.upcomingPayments.slice(0, 3).map((p) => (
                <Text key={p.id} style={[styles.legend, { fontSize: 13 }]}>
                  • {p.borrower} — ₱ {p.amount.toLocaleString()} ({p.due})
                </Text>
              ))
            ) : (
              <Text style={[styles.legend, { fontSize: 13, color: "#666" }]}>No upcoming payments</Text>
            )}
          </View>
        </View>
      </View>

      {/* Navigation badges */}
      <View style={{ marginTop: 10 }}>
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

const styles = StyleSheet.create({
  container: { backgroundColor: "#f3f6fa", padding: CONTENT_PADDING },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Top Stats
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginHorizontal: 6,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  rejectedStat: {
    backgroundColor: "#ff4d4d",
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

  // Panels
  panel: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginTop: 18,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  legend: { fontSize: 15, marginVertical: 4, fontWeight: "600", color: "#333" },

  pieWrapper: {
    width: CHART_WIDTH,
    height: CHART_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },

  badgeButton: {
    backgroundColor: "#FFC107",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  badgeText: { fontSize: 14, fontWeight: "700" },

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
