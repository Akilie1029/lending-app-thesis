import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { COLORS } from '../constants/colors';
import { useFocusEffect } from '@react-navigation/native';
import { HomeScreenProps } from '../../App'; 

// --- Type Definitions for the data we expect ---
interface DecodedToken {
  user: { id: string; role: string; };
}

interface Loan {
  id: string;
  amount_requested: string;
  repayment_term_months: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
}

// --- The Component ---
const HomeScreen = ({ navigation }: HomeScreenProps) => { 
  // --- State Variables ---
  const [user, setUser] = useState<{ id: string; role: string } | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Data Fetching Logic ---
  useFocusEffect(
    React.useCallback(() => {
      const bootstrap = async () => {
        setIsLoading(true);
        // --- FIX: Use the correct key 'userToken' to match LoginScreen ---
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          try {
            const decodedToken = jwtDecode<DecodedToken>(token);
            setUser(decodedToken.user);

            if (decodedToken.user.role === 'admin') {
              fetchAdminLoans(token);
            } else {
              fetchBorrowerLoans(token);
            }
          } catch (e) {
            console.error("Invalid token:", e);
            handleLogout(); // If token is bad, force logout
          }
        } else {
          setIsLoading(false);
          navigation.replace('Login');
        }
      };

      bootstrap();
    }, [])
  );

  const fetchAdminLoans = async (token: string) => {
    try {
      const serverUrl = 'http://192.168.1.222:5001';
      const response = await axios.get(`${serverUrl}/api/admin/loans`, {
        headers: { 'x-auth-token': token },
      });
      setLoans(response.data);
    } catch (error) {
      console.error('Failed to fetch admin loans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBorrowerLoans = async (token: string) => {
    try {
      const serverUrl = 'http://192.168.1.222:5001';
      const response = await axios.get(`${serverUrl}/api/loans/my-loans`, {
        headers: { 'x-auth-token': token },
      });
      setLoans(response.data);
    } catch (error) {
      console.error('Failed to fetch borrower loans:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogout = async () => {
      // --- FIX: Use the correct key 'userToken' here as well ---
      await AsyncStorage.removeItem('userToken');
      navigation.replace('Login'); 
  };

  // --- UI Rendering ---
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // --- ADMIN DASHBOARD UI ---
  if (user?.role === 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
        <FlatList
          data={loans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.adminLoanItem}>
              <Text>Amount: ₱{item.amount_requested}</Text>
              <Text>Term: {item.repayment_term_months} months</Text>
              <Text>Status: {item.status}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No loan applications found.</Text>}
        />
      </SafeAreaView>
    );
  }

  // --- BORROWER DASHBOARD UI ---
  return (
    <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Your Dashboard</Text>
            <TouchableOpacity onPress={handleLogout}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Current Loan Status</Text>
            <Text style={styles.statusValue}>
              {loans.length > 0 ? loans[0].status.toUpperCase() : 'NO ACTIVE LOAN'}
            </Text>
        </View>

        <TouchableOpacity 
            style={styles.applyButton}
            onPress={() => navigation.navigate('LoanApplication')}
        >
            <Text style={styles.applyButtonText}>Apply for New Loan</Text>
        </TouchableOpacity>

        <Text style={styles.historyTitle}>Loan History</Text>
        <FlatList
          data={loans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.loanItem}>
              <Text>Amount: ₱{item.amount_requested}</Text>
              <Text>Status: {item.status}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>You have no loan history.</Text>}
        />
    </SafeAreaView>
  );
};

// --- StyleSheet (No changes needed here) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
  },
  headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: COLORS.textDark,
  },
  logoutText: {
      fontSize: 16,
      color: COLORS.primary,
      fontWeight: '600',
  },
  statusCard: {
      backgroundColor: COLORS.primary,
      borderRadius: 15,
      padding: 20,
      marginHorizontal: 20,
      marginBottom: 20,
      alignItems: 'center',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 5,
  },
  statusLabel: {
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.8)',
  },
  statusValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: 'white',
      marginTop: 5,
  },
  applyButton: {
      backgroundColor: '#34C759', // A positive green color
      borderRadius: 15,
      padding: 18,
      marginHorizontal: 20,
      marginBottom: 30,
      alignItems: 'center',
  },
  applyButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
  },
  historyTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: COLORS.textDark,
      marginLeft: 20,
      marginBottom: 10,
  },
  loanItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#eee'
  },
  adminLoanItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#eee'
  },
  emptyText: {
      textAlign: 'center',
      color: '#666',
      marginTop: 20,
  },
});

export default HomeScreen;

