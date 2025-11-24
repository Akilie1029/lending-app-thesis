import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useFocusEffect } from "@react-navigation/native";
import { HomeScreenProps } from "../../App";

const { width } = Dimensions.get("window");
const scale = (size: number) => (width / 375) * size;

const API_BASE = "http://192.168.1.222:5001/api";

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeLoan, setActiveLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        setError("No token found");
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      const [userRes, txRes, activeLoanRes] = await Promise.all([
        axios.get(`${API_BASE}/auth/me`, { headers }),
        axios.get(`${API_BASE}/transactions/my`, { headers }),
        axios.get(`${API_BASE}/loans/my-active`, { headers }),
      ]);

      setUser(userRes.data);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      setActiveLoan(activeLoanRes.data?.id ? activeLoanRes.data : null);
    } catch (error: any) {
      console.error("❌ Fetch failed:", error.message);
      setError("Failed to load dashboard data");
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A9EFA" />
      </View>
    );
  }

  /** ───────────────────────────────────────────────
   *  IF NO ACTIVE LOAN
   * ─────────────────────────────────────────────── */
  const noActiveLoan = !activeLoan;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* ===== HEADER ===== */}
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.leftSection}>
            <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuContainer}>
              <Text style={styles.menuIcon}>☰</Text>
              <Text style={styles.headerSubtitle}>Welcome Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerName}>{user?.full_name}</Text>
          </View>
          <Text style={styles.bellIcon}>🔔</Text>
        </View>
      </LinearGradient>

      {/* ======================================================
        BALANCE CARD
        Shows:
        - Apply Loan (if NO active loan)
        - Daily Payment + Next Due Date + Make Payment (if active)
      ====================================================== */}
      <View style={styles.balanceCard}>
        {noActiveLoan ? (
          <>
            <Text style={styles.balanceLabel}>No active loan</Text>

            <TouchableOpacity
              style={[styles.primaryButton, { width: "100%" }]}
              onPress={() => navigation.navigate("Loan Application")}
            >
              <Text style={styles.primaryButtonText}>Apply for Loan</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.dailyPaymentText}>
              Daily Payment: ₱ {activeLoan.daily_payment?.toLocaleString()}
            </Text>

            <Text style={styles.dueDateText}>
              Next Due Date: {new Date(activeLoan.latest_due_date).toLocaleDateString()}
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, { width: "100%" }]}
              onPress={() => navigation.navigate("RepayLoan", { loan: activeLoan })}
            >
              <Text style={styles.primaryButtonText}>Make a Payment</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ======================================================
        LOAN STATUS SECTION
      ====================================================== */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Loan Status</Text>
      </View>

      {noActiveLoan ? (
        <View style={styles.loanCard}>
          <Text style={{ fontSize: 16, color: "#444", textAlign: "center" }}>
            You currently have no active loan.
          </Text>
          <Text style={{ fontSize: 14, color: "#777", textAlign: "center", marginTop: 5 }}>
            Apply now to get started!
          </Text>
        </View>
      ) : (
        <View style={styles.loanCard}>
          <View style={styles.loanRow}>
            <View>
              <Text style={styles.loanAmount}>
                ₱ {Number(activeLoan.principal).toLocaleString()}
              </Text>
              <Text style={styles.loanAmountLabel}>Approved Loan Amount</Text>
            </View>

            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.loanAmount}>
                {new Date(activeLoan.disbursed_at).toLocaleDateString()}
              </Text>
              <Text style={styles.loanAmountLabel}>Date Approved</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.secondaryButton, { width: "100%", marginTop: 12 }]}
            onPress={() => navigation.navigate("Loan Details", { loan: activeLoan })}
          >
            <Text style={styles.secondaryButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ======================================================
        RECENT TRANSACTIONS
      ====================================================== */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <Text style={styles.seeAll}>See all</Text>
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
    </ScrollView>
  );
};

export default HomeScreen;

/* === KEEP ALL YOUR EXISTING STYLES BELOW === */



const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f7fb', marginTop: 20 },
  header: { paddingHorizontal: 20, paddingVertical: 25, borderRadius: 25, marginHorizontal: 10 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leftSection: { flexDirection: 'column' },
  menuContainer: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: { fontSize: 24, marginRight: 8, color: '#fff' },
  headerSubtitle: { fontSize: 20, color: '#fff', fontWeight: '500' },
  headerName: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 4, marginLeft: 25 },
  bellIcon: { fontSize: 22, color: '#fff' },
  balanceCard: {
    backgroundColor: '#fff',
    marginHorizontal: 30,
    marginTop: -10,
    borderRadius: 20,
    padding: 15,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#169AF9',
  },
  balanceCenter: { alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  balanceAmount: { fontSize: 35, fontWeight: '700', color: '#000', textAlign: 'center' },
  balanceLabel: { color: '#666', fontSize: 16, marginTop: 5, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  primaryButton: {
    backgroundColor: '#0A9EFA',
    borderRadius: 10,
    width: '48%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#0A9EFA',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',


  },
  secondaryButtonText: { color: '#0A9EFA', fontWeight: '700' },
  sectionHeader: {
    marginTop: 25,
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  seeAll: { color: '#007BFF', fontWeight: '400', marginRight: 15 },
  loanCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 15,
    marginTop: 5,
    elevation: 4,
    borderWidth: 3,
    borderColor: '#169AF9',
  },
  loanRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanAmount: { fontSize: 20, fontWeight: '700', color: '#000' },
  loanAmountLabel: { color: '#666', fontSize: 12, marginTop: 2 },
  transactionsContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 3,
    borderColor: '#169AF9',
    borderRadius: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  transactionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    borderRadius: 16,
    padding: 8,
    marginVertical: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
  },
  transactionLeft: { flexDirection: 'row', alignItems: 'center' },
  transactionIcon: { fontSize: 22, marginRight: 10 },
  transactionType: { fontSize: 16, fontWeight: '600', color: '#000' },
  transactionDate: { color: '#777', fontSize: 13 },
  transactionAmount: { fontSize: 16, fontWeight: '700', color: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
