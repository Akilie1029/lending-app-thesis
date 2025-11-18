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
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AdminHeader from "../components/AdminHeader";
import RadialRing from "../components/RadialRing";

const { width } = Dimensions.get("window");
const CONTENT_PADDING = 12;
const SMALL_PIE_SIZE = 110;
const BIG_CHART_WIDTH = Math.min(width - CONTENT_PADDING * 2 - 24, 720);

type DashboardResponse = {
  borrowerCount: number;
  activeLoanCount: number;
  rejectedCount: number;
  loanStatusDistribution: { unpaidAmount: number; paidAmount: number; overdueAmount: number };
  paymentOverview: { collectiblesToday: number; actualPayments: number };
  pendingLoanApproval: number;
  pendingDisbursement: number;
  totalDisbursedLoan: number;
  loansAtRisk?: number;
  weeklyCollections?: number[]; // length 7
  dailyRepayments?: number[]; // sparkline
  upcomingPayments?: Array<{ id: string; borrower: string; due: string; amount: number }>;
};

const chartConfig = {
  backgroundGradientFrom: "#ffffff",
  backgroundGradientTo: "#ffffff",
  color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(120, 130, 140, ${opacity})`,
  strokeWidth: 2,
};

export default function AdminDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigation = useNavigation<any>();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  useEffect(() => {
    if (stats) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [stats, fadeAnim]);

  // fetch
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

      const res = await axios.get("http://192.168.1.222:5001/api/admin/dashboard-stats", {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      // safe defaults for missing arrays
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
      console.error("Dashboard load error:", err);
      setErrorMsg("Failed to load dashboard. Check connection.");
      setLoading(false);
    }
  };

  // placeholders
  function generatePlaceholderWeekly(total: number) {
    const base = Math.max(0, Math.round((total || 0) / 28));
    return Array.from({ length: 7 }, (_, i) => Math.max(0, base + Math.round(Math.sin(i + 1) * base * 0.5)));
  }

  function generatePlaceholderDaily(total: number) {
    const base = Math.max(0, Math.round((total || 0) / 70));
    return Array.from({ length: 12 }, (_, i) => Math.max(0, base + Math.round(Math.cos(i + 1) * base * 0.4)));
  }

  // UI states
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

  // helpers
  const totalForRings =
    stats.loanStatusDistribution.unpaidAmount +
    stats.loanStatusDistribution.paidAmount +
    stats.loanStatusDistribution.overdueAmount;

  const pctNum = (value: number, total: number) => {
    if (!total) return 0;
    return Math.round((value / total) * 100);
  };

  const totalPayment = stats.paymentOverview.collectiblesToday + stats.paymentOverview.actualPayments;

  // charts sizes
  const bigChartWidth = Math.min(BIG_CHART_WIDTH, width - CONTENT_PADDING * 2 - 20);

  // weekly labels
  const weeklyLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].slice(0, (stats.weeklyCollections || []).length);

  // spark labels
  const sparkLabels = (stats.dailyRepayments || []).map((_, i) => `${i + 1}`);

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
          <Text style={[styles.statFoot, { color: "rgba(255,255,255,0.9)" }]}>Declined apps</Text>
        </View>
      </View>

      {/* Loan status radial rings (3 in one row) */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Loan Status</Text>
        <View style={styles.ringRow}>
          <RadialRing
            progress={pctNum(stats.loanStatusDistribution.paidAmount, totalForRings)}
            label="Paid"
            amount={stats.loanStatusDistribution.paidAmount}
            colors={{ start: "#19d06b", end: "#00c853" }}
          />

          <RadialRing
            progress={pctNum(stats.loanStatusDistribution.unpaidAmount, totalForRings)}
            label="Unpaid"
            amount={stats.loanStatusDistribution.unpaidAmount}
            colors={{ start: "#4facfe", end: "#00c6fb" }}
          />

          <RadialRing
            progress={pctNum(stats.loanStatusDistribution.overdueAmount, totalForRings)}
            label="Overdue"
            amount={stats.loanStatusDistribution.overdueAmount}
            colors={{ start: "#ff6b6b", end: "#ff3b30" }}
          />
        </View>
      </View>

      {/* Payment overview: micro area + amount summary */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Overview</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.legend}>🟦 {pctNum(stats.paymentOverview.collectiblesToday, totalPayment)} Collectibles — ₱ {stats.paymentOverview.collectiblesToday.toLocaleString()}</Text>
            <Text style={styles.legend}>🟩 {pctNum(stats.paymentOverview.actualPayments, totalPayment)} Payments — ₱ {stats.paymentOverview.actualPayments.toLocaleString()}</Text>
          </View>

          <View style={{ width: 140, alignItems: "center" }}>
            {/* small sparkline-like area (line chart) */}
            <LineChart
              data={{
                labels: sparkLabels.length ? sparkLabels : stats.dailyRepayments?.map((_, i) => `${i + 1}`) || [],
                datasets: [{ data: stats.dailyRepayments || [] }],
              }}
              width={140}
              height={90}
              withDots={false}
              withInnerLines={false}
              withOuterLines={false}
              withVerticalLabels={false}
              withHorizontalLabels={false}
              chartConfig={{
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                color: (opacity = 1) => `rgba(0,200,83,${opacity})`,
                propsForDots: { r: "3" },
              }}
              bezier
              style={{ paddingRight: 0 }}
            />
          </View>
        </View>
      </View>

      {/* Collections last 7 days (Bar chart) */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Collections — Last 7 days</Text>
        <Animated.View style={{ opacity: fadeAnim }}>
          <BarChart
            data={{
              labels: weeklyLabels.length ? weeklyLabels : ["D1", "D2", "D3", "D4", "D5", "D6", "D7"],
              datasets: [{ data: stats.weeklyCollections || [0, 0, 0, 0, 0, 0, 0] }],
            }}
            width={bigChartWidth}
            height={170}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(10,132,255,${opacity})`,
            }}
            fromZero
            showValuesOnTopOfBars
            style={{ borderRadius: 8 }}
          />

          <View style={{ height: 10 }} />

          <Text style={[styles.panelTitle, { fontSize: 15 }]}>Repayments (sparkline)</Text>

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
            withShadow={true}
            withInnerLines={false}
            bezier
            fromZero
            style={{ marginVertical: 6, borderRadius: 8 }}
          />
        </Animated.View>
      </View>

      {/* Business insights */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Business Insights</Text>
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

  pieWrapper: { width: SMALL_PIE_SIZE, height: SMALL_PIE_SIZE, justifyContent: "center", alignItems: "center" },

  badgeButton: { backgroundColor: "#FFC107", padding: 12, borderRadius: 10, marginTop: 10, flexDirection: "row", justifyContent: "space-between" },
  badgeText: { fontSize: 15, fontWeight: "700" },
  badgeCount: { backgroundColor: "#ff3b30", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeCountText: { color: "#fff", fontWeight: "800" },
  badgeCountTextRed: { color: "#ff3b30", fontWeight: "800" },

  retryButton: { marginTop: 12, backgroundColor: "#0A9EFA", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "700" },
});
