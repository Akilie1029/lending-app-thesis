import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { HomeScreenProps } from '../../App';

const { width } = Dimensions.get('window');
const scale = (size: number) => (width / 375) * size;

const API_BASE = 'http://192.168.1.222:5001/api';

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all user data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
          setError('No token found');
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        const [userRes, balRes, txRes, loanRes] = await Promise.all([
          axios.get(`${API_BASE}/auth/me`, { headers }),
          axios.get(`${API_BASE}/users/balance`, { headers }),
          axios.get(`${API_BASE}/transactions/my`, { headers }),
          axios.get(`${API_BASE}/loans/my-loans`, { headers }),
        ]);

        setUser(userRes.data);
        setBalance(Number(balRes.data.balance) || 0);
        setTransactions(txRes.data);

        const activeLoan =
          loanRes.data.find((l: any) => l.status === 'approved') || loanRes.data[0];
        setLoan(activeLoan || null);
      } catch (error: any) {
        console.error('❌ Fetch failed:', error.message);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Redirect if no token
  useEffect(() => {
    if (error === 'No token found') {
      navigation.replace('Login');
    }
  }, [error]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A9EFA" />
      </View>
    );
  }

  // Error state
  if (error && error !== 'No token found') {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: 'red', fontSize: 16 }}>Error: {error}</Text>
        <TouchableOpacity
          onPress={() => {
            setError(null);
            setLoading(true);
          }}
        >
          <Text style={{ color: '#0A9EFA', marginTop: 10 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasActiveLoan = !!loan;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* ===== HEADER ===== */}
      <LinearGradient colors={['#169AF9', '#37AAF2']} style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.leftSection}>
            <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuContainer}>
              <Text style={styles.menuIcon}>☰</Text>
              <Text style={styles.headerSubtitle}>Welcome Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerName}>{user?.full_name || 'User'}</Text>
          </View>
          <Text style={styles.bellIcon}>🔔</Text>
        </View>
      </LinearGradient>

      {/* ===== BALANCE CARD ===== */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceCenter}>
          <Text style={styles.balanceAmount}>
            ₱ {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.balanceLabel}>Total Available Balance</Text>
        </View>

        <View style={styles.buttonRow}>
          {/* Withdraw button */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              balance <= 0 && { backgroundColor: '#ccc' },
            ]}
            disabled={balance <= 0}
          >
            <Text style={styles.primaryButtonText}>Withdraw</Text>
          </TouchableOpacity>

          {/* Right button logic */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (hasActiveLoan) navigation.navigate('Loan Details');
              else if (balance <= 0) navigation.navigate('Loan Application');
              else navigation.navigate('RepayLoan');
            }}
          >
            <Text style={styles.primaryButtonText}>
              {hasActiveLoan
                ? 'View Loan Status'
                : balance <= 0
                ? 'Apply for Loan'
                : 'Repay Loan'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ===== ACTIVE LOAN SECTION ===== */}
      {loan ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Loan</Text>
            <Text style={styles.seeAll}>See all</Text>
          </View>

          <View style={styles.loanCard}>
            <View style={styles.loanRow}>
              <View style={styles.loanDueContainer}>
                <Text style={styles.loanAmount}>
                  ₱{' '}
                  {Number(loan.remaining_balance || loan.amount_requested).toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2 }
                  )}
                </Text>
                <Text style={styles.loanAmountLabel}>Amount Due</Text>
              </View>

              <View style={styles.loanDateContainer}>
                <Text style={styles.loanDate}>
                  {new Date(loan.next_due_date).toLocaleDateString()}
                </Text>
                <Text style={styles.loanDateLabel}>Next Due Date</Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Make a Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          <Text style={{ color: '#777', fontSize: 16 }}>No active loans found</Text>
        </View>
      )}

      {/* ===== RECENT TRANSACTIONS ===== */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <Text style={styles.seeAll}>See all</Text>
      </View>

      <View style={styles.transactionsContainer}>
        {transactions.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#999', padding: 10 }}>
            No recent transactions found
          </Text>
        ) : (
          transactions.map((tx, i) => {
            const typeLower = tx.type.toLowerCase();
            const icon = typeLower.includes('loan payment') ? '⬆️' : '⬇️';
            const iconColor = typeLower.includes('loan payment') ? '#FF3B30' : '#4CD964';

            return (
              <View key={i} style={styles.transactionCard}>
                <View style={styles.transactionLeft}>
                  <Text style={[styles.transactionIcon, { color: iconColor }]}>{icon}</Text>
                  <View>
                    <Text style={styles.transactionType}>{tx.type}</Text>
                    <Text style={styles.transactionDate}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.transactionAmount}>
                  ₱ {Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

export default HomeScreen;

// === STYLES unchanged ===
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
    width: '48%',
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
  loanDueContainer: { alignItems: 'center', marginBottom: 10, marginLeft: 15 },
  loanAmount: { fontSize: 20, fontWeight: '700', color: '#000' },
  loanAmountLabel: { color: '#666', fontSize: 12, marginLeft: 15 },
  loanDateContainer: { alignItems: 'center', marginBottom: 10, marginRight: 15 },
  loanDate: { fontSize: 14, fontWeight: '600', color: '#000' },
  loanDateLabel: { color: '#666', fontSize: 12 },
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
