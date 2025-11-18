import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE = 'http://192.168.1.222:5001/api';

const PaymentHistoryScreen = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(`${API_BASE}/transactions/my-payments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPayments(res.data || []);
    } catch (err) {
      console.error("❌ Failed to load payments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#169AF9" />
      </View>
    );
  }

  if (payments.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#777', fontSize: 16 }}>
          No payment history found
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.type}>Loan Payment</Text>
              <Text style={styles.amount}>
                ₱ {Number(item.amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>

            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

export default PaymentHistoryScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 15,
    backgroundColor: '#f6f7fb',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 15,
    marginVertical: 6,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#169AF9',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  type: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#169AF9',
  },
  date: {
    marginTop: 4,
    fontSize: 13,
    color: '#777',
  },
});
