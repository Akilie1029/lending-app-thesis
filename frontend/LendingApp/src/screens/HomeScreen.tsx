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
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useFocusEffect } from "@react-navigation/native";
import { HomeScreenProps } from "../../App";
import { API_BASE } from "../config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// BANNERS
const BANNERS = [
  require("../../assets/banners/banner1.jpg"),
  require("../../assets/banners/banner2.jpg"),
  require("../../assets/banners/banner3.jpg"),
];

const LOG_PREFIX = "[HOME]";

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeLoan, setActiveLoan] = useState<any>(null);
  const [latestLoan, setLatestLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Banner auto-slide
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerRef = useRef<FlatList>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (bannerIndex + 1) % BANNERS.length;
      setBannerIndex(nextIndex);
      bannerRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 4000);

    return () => clearInterval(interval);
  }, [bannerIndex]);

  // ============== FETCH DATA ==============
  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      const [userRes, txRes, activeLoanRes, latestLoanRes] = await Promise.all([
        axios.get(`${API_BASE}/auth/me`, { headers }),
        axios.get(`${API_BASE}/transactions/my`, { headers }),
        axios.get(`${API_BASE}/loans/my-active`, { headers }),
        axios.get(`${API_BASE}/loans/my-latest`, { headers }),
      ]);

      setUser(userRes.data);
      setTransactions(txRes.data || []);

      const active =
        activeLoanRes.data?.loan ||
        activeLoanRes.data?.activeLoan ||
        activeLoanRes.data;

      setActiveLoan(active?.id ? active : null);

      const latest =
        latestLoanRes.data?.latestLoan ||
        latestLoanRes.data?.loan ||
        latestLoanRes.data;

      setLatestLoan(latest?.id ? latest : null);
    } catch (e) {
      console.log(LOG_PREFIX, "❌ Fetch error:", e);
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

  // ============== GLOBAL AMOUNT LOGIC ==============
  const getLoanAmount = (loan: any) => {
    if (!loan) return 0;

    const approved = Number(loan.approved_principal || 0);
    const principal = Number(loan.principal || 0);

    // If admin approved a specific amount → always use approved_principal
    if (approved > 0) return approved;

    return principal;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  const hasActiveLoan = !!activeLoan;

  const hasPendingLoan =
    latestLoan &&
    (latestLoan.status === "pending" || latestLoan.status === "approved");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* ================= HEADER ================= */}
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

          <Text style={styles.bellIcon}>🔔</Text>
        </View>
      </LinearGradient>

      {/* ================= BALANCE CARD ================= */}
      <View style={styles.balanceCard}>
        {hasActiveLoan ? (
          <>
            <Text style={styles.dailyPaymentText}>
              Daily Payment: ₱{" "}
              {Number(activeLoan.daily_payment ?? 0).toLocaleString()}
            </Text>

            <Text style={styles.dueDateText}>
              Next Due Date:{" "}
              {activeLoan.latest_due_date
                ? new Date(activeLoan.latest_due_date).toLocaleDateString()
                : "—"}
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, { width: "100%" }]}
              onPress={() =>
                navigation.navigate("RepayLoan", { loan: activeLoan })
              }
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
                  backgroundColor: hasPendingLoan ? "#A0A0A0" : "#0A9EFA",
                },
              ]}
              disabled={hasPendingLoan}
              onPress={() => navigation.navigate("Loan Application")}
            >
              <Text style={styles.primaryButtonText}>
                {hasPendingLoan ? "Pending Approval" : "Apply for Loan"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ================= PENDING LOAN ================= */}
      {hasPendingLoan && !hasActiveLoan && (
        <View style={styles.loanCard}>
          <View style={styles.loanRow}>
            <View>
              <Text style={styles.loanAmount}>
                ₱ {getLoanAmount(latestLoan).toLocaleString()}
              </Text>

              <Text style={styles.loanAmountLabel}>
                {latestLoan.status === "approved"
                  ? "Pending Disbursement"
                  : "Pending Approval"}
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
            onPress={() =>
              navigation.navigate("Loan Details", { loan: latestLoan })
            }
          >
            <Text style={styles.secondaryButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ================= ACTIVE LOAN ================= */}
      {hasActiveLoan && (
        <View style={styles.loanCard}>
          <View style={styles.loanRow}>
            <View>
              <Text style={styles.loanAmount}>
                ₱ {getLoanAmount(activeLoan).toLocaleString()}
              </Text>
              <Text style={styles.loanAmountLabel}>Approved Loan Amount</Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.loanAmount}>
                {activeLoan.disbursed_at
                  ? new Date(activeLoan.disbursed_at).toLocaleDateString()
                  : "—"}
              </Text>
              <Text style={styles.loanAmountLabel}>Date Approved</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, { width: "100%", marginTop: 12 }]}
            onPress={() =>
              navigation.navigate("Loan Details", { loan: activeLoan })
            }
          >
            <Text style={styles.secondaryButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ================= RECENT TRANSACTIONS ================= */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
      </View>

      <View style={styles.transactionsContainer}>
        {transactions.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#999", padding: 10 }}>
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
      </View>

      {/* ================= BANNER FOOTER ================= */}
      <View style={styles.bannerContainer}>
        <FlatList
          ref={bannerRef}
          data={BANNERS}
          keyExtractor={(_, i) => i.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(ev) => {
            const index = Math.round(
              ev.nativeEvent.contentOffset.x / SCREEN_WIDTH
            );
            setBannerIndex(index);
          }}
          renderItem={({ item }) => (
            <Image source={item} style={styles.bannerImage} />
          )}
          style={{ width: SCREEN_WIDTH }}
        />

        {/* dots */}
        <View style={styles.dotsRow}>
          {BANNERS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                bannerIndex === i ? styles.dotActive : null,
              ]}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

export default HomeScreen;

/* ==================== STYLES ==================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb", marginTop: 20 },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 25,
    borderRadius: 25,
    marginHorizontal: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  menuContainer: { flexDirection: "row", alignItems: "center" },
  menuIcon: { fontSize: 24, marginRight: 8, color: "#fff" },
  headerSubtitle: { fontSize: 20, color: "#fff", fontWeight: "500" },
  headerName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 4,
    marginLeft: 25,
  },
  bellIcon: { fontSize: 22, color: "#fff" },

  bannerContainer: {
    width: SCREEN_WIDTH,
    marginTop: 10,
    marginBottom: 10,
  },
  bannerImage: {
    width: SCREEN_WIDTH,
    height: 160,
    resizeMode: "cover",
    borderRadius: 10,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ccc",
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: "#169AF9" },

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
    marginTop: 5,
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#0A9EFA",
    borderRadius: 10,
    width: "100%",
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },

  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#0A9EFA",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#0A9EFA", fontWeight: "700" },

  sectionHeader: { marginTop: 25, marginHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#000" },

  loanCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 15,
    marginTop: 5,
    elevation: 4,
    borderWidth: 3,
    borderColor: "#169AF9",
  },
  loanRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loanAmount: { fontSize: 20, fontWeight: "700", color: "#000" },
  loanAmountLabel: { color: "#666", fontSize: 12, marginTop: 2 },

  transactionsContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 3,
    borderColor: "#169AF9",
    borderRadius: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  transactionCard: {
    backgroundColor: "#fff",
    marginHorizontal: 10,
    borderRadius: 16,
    padding: 8,
    marginVertical: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 3,
  },
  transactionLeft: { flexDirection: "row", alignItems: "center" },
  transactionIcon: { fontSize: 22, marginRight: 10 },
  transactionType: { fontSize: 16, fontWeight: "600", color: "#000" },
  transactionDate: { color: "#777", fontSize: 13 },
  transactionAmount: { fontSize: 16, fontWeight: "700", color: "#000" },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
