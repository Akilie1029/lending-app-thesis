import React, { useEffect, useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
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

  // --- 🔁 Fetch all user data ---
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

  // Initial load
  useEffect(() => {
    fetchData();
  }, []);

  // --- 🔄 Refresh automatically when screen is focused ---
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

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
            fetchData();
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

        {/* ✅ Unified button logic */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { width: '100%', backgroundColor: balance <= 0 ? '#0077C8' : '#0077C8' },
          ]}
          onPress={() => {
            if (!loan || loan.status === 'rejected') navigation.navigate('Loan Application');
            else if (loan.status === 'pending') return;
            else if (balance <= 0) navigation.navigate('Loan Application');
            else navigation.navigate('Withdraw');
          }}
          disabled={loan?.status === 'pending'}
        >
          <Text style={styles.primaryButtonText}>
            {loan
              ? loan.status === 'pending'
                ? 'Pending Approval'
                : balance <= 0
                ? 'Apply Loan'
                : 'Withdraw'
              : 'Apply Loan'}
          </Text>
        </TouchableOpacity>
      </View>

{/* ===== LOAN STATUS SECTION ===== */}
{loan ? (
  <>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Loan Status</Text>
    </View>

    <View style={styles.loanCard}>
      {/* --- Row: Amount (left) | Date (right) --- */}
      <View style={[styles.loanRow, { alignItems: 'center' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.loanAmount}>
            ₱{' '}
            {Number(loan.amount_requested || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </Text>
          <Text style={styles.loanAmountLabel}>
            {loan.status === 'approved'
              ? 'Approved Loan Amount'
              : loan.status === 'pending'
              ? 'Pending Loan Request'
              : loan.status === 'rejected'
              ? 'Rejected Loan Request'
              : 'Loan Amount'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>
            {loan.status === 'approved' && loan.next_due_date
              ? new Date(loan.next_due_date).toLocaleDateString()
              : new Date(loan.created_at).toLocaleDateString()}
          </Text>
          <Text style={{ color: '#666', fontSize: 12 }}>
            {loan.status === 'approved' ? 'Next Due Date' : 'Date Submitted'}
          </Text>
        </View>
      </View>

      {/* --- Fixed Row: Make Payment + View Details --- */}
      <View style={[styles.buttonRow, { marginTop: 10 }]}>
        {/* 🟦 Make Payment (always visible but disabled when pending or rejected) */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              width: '48%',
              backgroundColor:
                loan.status === 'approved' ? '#0A9EFA' : '#C7C7C7', // gray if not active
            },
          ]}
          disabled={loan.status !== 'approved'}
          onPress={() => {
            if (loan.status === 'approved') navigation.navigate('RepayLoan', { loan });
          }}
        >
          <Text
            style={[
              styles.primaryButtonText,
              { color: loan.status === 'approved' ? '#fff' : '#666' },
            ]}
          >
            Make a Payment
          </Text>
        </TouchableOpacity>

        {/* 📄 View Details (always active) */}
        <TouchableOpacity
          style={[styles.secondaryButton, { width: '48%' }]}
          onPress={() => navigation.navigate('Loan Details', { loan })}
        >
          <Text style={styles.secondaryButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  </>
) : (
  // 💬 No Loan Case
  <View style={{ alignItems: 'center', marginVertical: 20 }}>
    <Text style={{ color: '#777', fontSize: 16 }}>No loan found</Text>
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
