// src/screens/HomeScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  FlatList,
  Dimensions,
  SafeAreaView,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE } from "../config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const BANNERS = [
  require("../../assets/banners/banner1.jpg"),
  require("../../assets/banners/banner2.jpg"),
  require("../../assets/banners/banner3.jpg"),
];

const LOG_PREFIX = "[HOME]";

export default function HomeScreen({ navigation }: any) {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeLoan, setActiveLoan] = useState<any>(null);
  const [latestLoan, setLatestLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [unreadCount, setUnreadCount] = useState(0);

  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<FlatList>(null);

  // Auto-slide banner
  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (bannerIndex + 1) % BANNERS.length;
      setBannerIndex(nextIndex);
      bannerRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 4000);

    return () => clearInterval(interval);
  }, [bannerIndex]);

  // Fetch data safely (notifications isolated)
  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      // 🟦 Core loan/user requests (must never fail)
      const [userRes, txRes, activeRes, latestRes] = await Promise.all([
        axios.get(`${API_BASE}/auth/me`, { headers }),
        axios.get(`${API_BASE}/transactions/my`, { headers }),
        axios.get(`${API_BASE}/loans/my-active`, { headers }),
        axios.get(`${API_BASE}/loans/my-latest`, { headers }),
      ]);

      setUser(userRes.data);
      setTransactions(txRes.data || []);

      // ACTIVE LOAN PARSE
      const active =
        activeRes.data?.loan ||
        activeRes.data?.activeLoan ||
        activeRes.data;

      setActiveLoan(active?.id ? active : null);

      // LATEST LOAN PARSE
      const latest =
        latestRes.data?.latestLoan ||
        latestRes.data?.loan ||
        latestRes.data;

      setLatestLoan(latest?.id ? latest : null);

      // 🟦 Notifications (safe mode)
      try {
        const notifRes = await axios.get(`${API_BASE}/notifications/my`, {
          headers,
        });

        const notifs = notifRes.data?.notifications || [];
        const unread = notifs.filter((n: any) => !n.is_read).length;
        setUnreadCount(unread);
      } catch (notifErr) {
        console.log("[HOME] Notifications endpoint not ready → ignoring");
        setUnreadCount(0); // fallback
      }
    } catch (err) {
      console.log(LOG_PREFIX, "❌ Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const getLoanAmount = (loan: any) => {
    if (!loan) return 0;
    const approved = Number(loan.approved_principal || 0);
    const principal = Number(loan.principal || 0);
    return approved > 0 ? approved : principal;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  const status = latestLoan?.status?.toLowerCase() || null;

  const hasUnfinishedLoan =
    status === "pending" ||
    status === "approved" ||
    status === "approved_pending_disburse" ||
    status === "active";

  return (
    <SafeAreaView style={styles.safe}>

      {/* FIXED HEADER */}
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            style={styles.menuContainer}
          >
            <Text style={styles.menuIcon}>☰</Text>
            <Text style={styles.headerSubtitle}>Welcome Back</Text>
            <Text style={styles.headerName}>{user?.full_name}</Text>
          </TouchableOpacity>

          {/* BELL ICON WITH BADGE */}
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
            style={styles.bellWrapper}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* BALANCE CARD */}
      <View style={styles.balanceCard}>
        {status === "active" && activeLoan ? (
          <>
            <Text style={styles.dailyPaymentText}>
              Daily Payment: ₱ {Number(activeLoan.daily_payment).toLocaleString()}
            </Text>

            <Text style={styles.dueDateText}>
              Next Due Date:{" "}
              {activeLoan.latest_due_date
                ? new Date(activeLoan.latest_due_date).toLocaleDateString()
                : "—"}
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, { width: "100%" }]}
              onPress={() => navigation.navigate("RepayLoan", { loan: activeLoan })}
            >
              <Text style={styles.primaryButtonText}>Make a Payment</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.balanceLabel}>No active loan</Text>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  width: "100%",
                  backgroundColor: hasUnfinishedLoan ? "#A0A0A0" : "#0A9EFA",
                },
              ]}
              disabled={hasUnfinishedLoan}
              onPress={() => navigation.navigate("Loan Application")}
            >
              <Text style={styles.primaryButtonText}>
                {hasUnfinishedLoan ? "Loan Processing" : "Apply for Loan"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* SCROLLABLE BODY */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 30 }}
        nestedScrollEnabled
      >

        {/* LOAN STATUS CARD */}
        <View style={styles.loanCard}>
          <Text style={styles.loanStatusHeader}>Loan Status</Text>

          {!latestLoan && (
            <Text style={styles.noLoanText}>No loans yet.</Text>
          )}

          {latestLoan && (
            <>
              <View style={styles.loanRow}>
                <View>
                  <Text style={styles.loanAmount}>
                    ₱ {getLoanAmount(latestLoan).toLocaleString()}
                  </Text>

                  <Text style={styles.loanAmountLabel}>
                    {status === "pending" && "Pending Approval"}
                    {status === "approved_pending_disburse" && "Awaiting Your Confirmation"}
                    {status === "approved" && "Pending Disbursement"}
                    {status === "active" && "Active Loan"}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.loanAmount}>
                    {new Date(latestLoan.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={styles.loanAmountLabel}>Date Submitted</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.secondaryButton, { width: "100%", marginTop: 12 }]}
                onPress={() => navigation.navigate("Loan Details", { loan: latestLoan })}
              >
                <Text style={styles.secondaryButtonText}>View Details</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* RECENT TRANSACTIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
        </View>

        <View
          style={[
            styles.transactionsContainer,
            { maxHeight: 600, minHeight: transactions.length === 0 ? 60 : undefined },
          ]}
        >
          <ScrollView nestedScrollEnabled>
            {transactions.length === 0 ? (
              <Text style={{ textAlign: "center", color: "#999", paddingTop: 10 }}>
                No recent transactions found
              </Text>
            ) : (
              transactions.map((tx, i) => (
                <View key={i} style={styles.transactionCard}>
                  <View style={styles.transactionLeft}>
                    <Text style={styles.transactionIcon}>⬇️</Text>
                    <View>
                      <Text style={styles.transactionType}>{tx.type}</Text>
                      <Text style={styles.transactionDate}>
                        {new Date(tx.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.transactionAmount}>
                    ₱ {Number(tx.amount).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        {/* BANNER */}
        <View style={styles.bannerContainer}>
          <FlatList
            ref={bannerRef}
            data={BANNERS}
            keyExtractor={(_, i) => i.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(ev) => {
              const index = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setBannerIndex(index);
            }}
            renderItem={({ item }) => (
              <Image source={item} style={styles.bannerImage} />
            )}
          />

          <View style={styles.dotsRow}>
            {BANNERS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, bannerIndex === i ? styles.dotActive : null]}
              />
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ==================== STYLES ==================== */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f7fb" },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 25,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  bellWrapper: { position: "relative", paddingRight: 5 },
  unreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#169AF9",
  },

  menuContainer: { flexDirection: "row", alignItems: "center" },
  menuIcon: { fontSize: 24, marginRight: 8, color: "#fff" },
  headerSubtitle: { fontSize: 20, color: "#fff", fontWeight: "500" },
  headerName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 20,
  },
  bellIcon: { fontSize: 26, color: "#fff" },

  body: { flex: 1, marginTop: 10 },

  balanceCard: {
    backgroundColor: "#fff",
    marginHorizontal: 30,
    marginTop: -10,
    borderRadius: 20,
    padding: 15,
    elevation: 5,
    borderWidth: 2,
    borderColor: "#169AF9",
  },
  dailyPaymentText: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  dueDateText: { fontSize: 14, color: "#333", marginBottom: 12 },
  balanceLabel: {
    color: "#666",
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#0A9EFA",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  loanCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 15,
    marginTop: 20,
    elevation: 4,
    borderWidth: 3,
    borderColor: "#169AF9",
  },
  loanStatusHeader: { fontSize: 18, fontWeight: "700", marginBottom: 10, color: "#000" },
  noLoanText: { fontSize: 15, color: "#666", marginVertical: 5 },
  loanRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  loanAmount: { fontSize: 20, fontWeight: "700", color: "#000" },
  loanAmountLabel: { color: "#666", fontSize: 12, marginTop: 2 },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#0A9EFA",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#0A9EFA", fontWeight: "700", fontSize: 15 },

  sectionHeader: { marginTop: 25, marginHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#000" },

  transactionsContainer: {
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#169AF9",
    paddingVertical: 10,
    overflow: "hidden",
  },

  transactionCard: {
    backgroundColor: "#fff",
    marginHorizontal: 10,
    borderRadius: 16,
    padding: 8,
    marginVertical: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 1,
  },
  transactionLeft: { flexDirection: "row", alignItems: "center" },
  transactionIcon: { fontSize: 22, marginRight: 10 },
  transactionType: { fontSize: 16, fontWeight: "600", color: "#000" },
  transactionDate: { color: "#777", fontSize: 13 },
  transactionAmount: { fontSize: 16, fontWeight: "700", color: "#000" },

  bannerContainer: { width: SCREEN_WIDTH, marginTop: 20, marginBottom: 20 },
  bannerImage: { width: SCREEN_WIDTH, height: 150, resizeMode: "cover" },

  dotsRow: { flexDirection: "row", justifyContent: "center", marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ccc", marginHorizontal: 4 },
  dotActive: { backgroundColor: "#169AF9" },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});
