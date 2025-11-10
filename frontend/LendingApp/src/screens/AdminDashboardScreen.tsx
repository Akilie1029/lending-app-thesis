import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

// Define the structure of a single loan object
interface Loan {
  id: string;
  user_id: string;
  amount_requested: string;
  status: string;
  purpose: string;
  // Add other relevant loan properties if needed
}

type AdminDashboardScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

const AdminDashboardScreen = ({ navigation }: AdminDashboardScreenProps) => {
  const [loans, setLoans] = useState<Loan[]>([]);

  // Function to fetch all loan applications
  const fetchLoans = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get('http://192.168.1.222:5001/api/admin/loans', {
        headers: { 'x-auth-token': token },
      });
      setLoans(response.data);
    } catch (error) {
      console.error('Failed to fetch loans:', error);
      Alert.alert('Error', 'Could not fetch loan applications.');
    }
  };

  // Fetch loans when the screen first loads
  useEffect(() => {
    fetchLoans();
  }, []);

  // This component will render a single loan item in the list
  const LoanItem = ({ item }: { item: Loan }) => (
    <View style={styles.loanItem}>
      <Text style={styles.loanAmount}>Amount: ₱{item.amount_requested}</Text>
      <Text style={styles.loanStatus}>Status: {item.status}</Text>
      <Text style={styles.loanPurpose}>Purpose: {item.purpose}</Text>
      <View style={styles.buttonContainer}>
        <Button title="Approve" onPress={() => {}} />
        <Button title="Reject" color="red" onPress={() => {}} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <FlatList
        data={loans}
        renderItem={LoanItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text>No pending loan applications.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  loanItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  loanAmount: { fontSize: 18, fontWeight: 'bold' },
  loanStatus: { fontSize: 16, fontStyle: 'italic', marginVertical: 4 },
  loanPurpose: { fontSize: 14, color: '#555' },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
});

export default AdminDashboardScreen;