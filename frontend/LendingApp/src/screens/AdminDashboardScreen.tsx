// src/screens/AdminDashboardScreen.tsx
// --------------------------------------------------------------
// ADMIN DASHBOARD SCREEN (UPDATED)
// Panels:
//  - Quick Stats (# borrowers, active loans, rejected)
//  - Pending Approvals & Pending Disbursements
//  - Business Overview (3 RadialRings + Vertical Legend)
//  - System Health
//
// Debug logs included
// --------------------------------------------------------------

import React, { useState, useCallback, useEffect } from "react";
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

const screenWidth = Dimensions.get("window").width;

export default function AdminDashboardScreen() {
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // ---------------------------
  // SYSTEM HEALTH STATE
  // ---------------------------
  const [apiStatus, setApiStatus] = useState<"online" | "offline">("online");
  const [dbStatus, setDbStatus] = useState<"connected" | "slow" | "error">(
    "connected"
  );
  const [latency, setLatency] = useState<number | null>(null);

  // --------------------------------------------------------------
  // LOAD DASHBOARD STATS
  // --------------------------------------------------------------
  useFocusEffect(
    useCallback(() => {
      console.log("📡 [Dashboard] Focused → refreshing stats...");
      load();
    }, [])
  );

  const load = async () => {
    try {
      setLoading(true);
      console.log("📡 Fetching /admin/dashboard-stats ...");

      const res = await api.get("/admin/dashboard-stats");

      console.log("📥 Dashboard Stats:", res.data);
      setStats(res.data || {});
    } catch (err) {
      console.log("❌ Dashboard load error:", err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------
  // SYSTEM HEALTH CHECK (15 SECONDS INTERVAL)
  // --------------------------------------------------------------
  const runHealthCheck = async () => {
    try {
      console.log("🩺 Running Health Check...");

      const start = Date.now();
      const res = await api.get("/admin/health");

      const ms = Date.now() - start;

      setApiStatus("online");

      // Determine DB status (connected / slow / error)
      if (res.data.database === "error") {
        setDbStatus("error");
      } else if (ms > 1000) {
        setDbStatus("slow");
      } else {
        setDbStatus("connected");
      }

      setLatency(ms);

      console.log("🟢 Health OK:", { ms, db: res.data.database });
    } catch (err) {
      console.log("🔴 Health check failed:", err?.message);
      setApiStatus("offline");
      setDbStatus("error");
      setLatency(null);
    }
  };

  useEffect(() => {
    runHealthCheck();
    const interval = setInterval(runHealthCheck, 15000);
    return () => clearInterval(interval);
  }, []);

  // --------------------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------------------
  if (loading || !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#169AF9" />
        <Text style={{ marginTop: 10 }}>Loading dashboard...</Text>
      </View>
    );
  }

  // --------------------------------------------------------------
  // EXTRACT NEW RING DATA
  // --------------------------------------------------------------
  const performance = stats.performance || {};
  const portfolio = stats.portfolio || {};
  const risk = stats.risk || {};

  return (
    <ScrollView style={styles.container}>
      <AdminHeader title="Admin Dashboard" />

      {/* --------------------------------------------------------------
          QUICK TOP CARDS
        -------------------------------------------------------------- */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Borrowers</Text>
          <Text style={styles.statValue}>{stats.borrowerCount ?? 0}</Text>
          <Text style={styles.statFoot}>Active users</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Active Loans</Text>
          <Text style={styles.statValue}>{stats.activeLoanCount ?? 0}</Text>
          <Text style={styles.statFoot}>Currently disbursed</Text>
        </View>

        <View style={[styles.statCard, styles.redCard]}>
          <Text style={[styles.statLabel, { color: "#fff" }]}>Rejected</Text>
          <Text style={[styles.statValue, { color: "#fff" }]}>
            {stats.rejectedCount ?? 0}
          </Text>
          <Text style={[styles.statFoot, { color: "#ffe" }]}>Declined</Text>
        </View>
      </View>


      {/* --------------------------------------------------------------
          BUSINESS OVERVIEW (3 RadialRings + Vertical Legend)
        -------------------------------------------------------------- */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Business Overview</Text>

        {/* RINGS */}
        <View style={styles.ringRow}>
          <RadialRing
            progress={performance.percent ?? 0}
            label=""
            amount={performance.totalRepaid ?? 0}
            colors={{ start: "#19d06b", end: "#00c853" }}
          />

          <RadialRing
            progress={portfolio.percent ?? 0}
            label=""
            amount={portfolio.activePrincipal ?? 0}
            colors={{ start: "#4facfe", end: "#00c6fb" }}
          />

          <RadialRing
            progress={risk.percent ?? 0}
            label=""
            amount={risk.overdueAmount ?? 0}
            colors={{ start: "#ff6b6b", end: "#ff3b30" }}
          />
        </View>

        {/* LEGEND */}
        <View style={styles.legendBox}>
          {/* PERFORMANCE */}
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: "#19d06b" }]} />
            <Text style={styles.legendLabel}>Performance</Text>
            <Text style={styles.legendValue}>
              ₱ {(performance.totalRepaid ?? 0).toLocaleString()}
            </Text>
          </View>

          {/* PORTFOLIO */}
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: "#4facfe" }]} />
            <Text style={styles.legendLabel}>Capital Deployed</Text>
            <Text style={styles.legendValue}>
              ₱ {(portfolio.activePrincipal ?? 0).toLocaleString()}
            </Text>
          </View>

          {/* RISK */}
          <View style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: "#ff6b6b" }]} />
            <Text style={styles.legendLabel}>Risk Exposure</Text>
            <Text style={styles.legendValue}>
              ₱ {(risk.overdueAmount ?? 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

           {/* --------------------------------------------------------------
          SYSTEM HEALTH (BOTTOM)
        -------------------------------------------------------------- */}
      <View style={styles.healthPanel}>
        <Text style={styles.healthTitle}>System Health</Text>

        <View style={styles.healthRow}>
          <View style={styles.healthCard}>
            <Text style={styles.healthLabel}>API</Text>
            <Text
              style={[
                styles.healthValue,
                { color: apiStatus === "online" ? "#34C759" : "#FF3B30" },
              ]}
            >
              {apiStatus.toUpperCase()}
            </Text>
          </View>

          <View style={styles.healthCard}>
            <Text style={styles.healthLabel}>Database</Text>
            <Text
              style={[
                styles.healthValue,
                {
                  color:
                    dbStatus === "connected"
                      ? "#34C759"
                      : dbStatus === "slow"
                      ? "#FFD60A"
                      : "#FF3B30",
                },
              ]}
            >
              {dbStatus.toUpperCase()}
            </Text>
          </View>

          <View style={styles.healthCard}>
            <Text style={styles.healthLabel}>Latency</Text>
            <Text style={styles.healthValue}>
              {latency !== null ? `${latency} ms` : "---"}
            </Text>
          </View>
        </View>
      </View>

      <View />
      {/* --------------------------------------------------------------
          PENDING ACTIONS
        -------------------------------------------------------------- */}
      <View style={styles.pendingBox}>
        <TouchableOpacity
          style={styles.pendingYellow}
          onPress={() => navigation.navigate("AdminLoanApprovalScreen" as never)}
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


    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fa", padding: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* TOP CARDS */
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

  /* PENDING ACTIONS */
  pendingBox: { marginTop: 10 },
  pendingYellow: {
    backgroundColor: "#FFC107",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
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
    marginBottom: 10,
  },
  pendingLight: { color: "#fff", fontWeight: "700" },
  pendingCountLight: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingNumRed: { color: "#ff3b30", fontWeight: "800" },

  /* BUSINESS OVERVIEW PANEL */
  panel: {
    marginTop: 5,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 14,
    elevation: 3,
  },
  panelTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },

  ringRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },

  legendBox: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 14,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  legendLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: "#333" },
  legendValue: { fontSize: 14, fontWeight: "800", color: "#111" },

  /* SYSTEM HEALTH */
  healthPanel: {
    marginTop: 10,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 14,
    elevation: 3,
  },
  healthTitle: { fontSize: 16, fontWeight: "800", marginBottom: 5 },
  healthRow: { flexDirection: "row", justifyContent: "space-between" },
  healthCard: {
    flex: 1,
    backgroundColor: "#f8f9fb",
    borderRadius: 5,
    alignItems: "center",
  },
  healthLabel: { fontSize: 12, color: "#666", marginBottom: 4, fontWeight: "600" },
  healthValue: { fontSize: 15, fontWeight: "800" },
});
