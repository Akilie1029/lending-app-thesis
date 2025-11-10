import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LoanApplicationScreenProps } from '../../App'; // Import the props type

const LoanApplicationScreen = ({ navigation }: LoanApplicationScreenProps) => {
  // 1. Create state variables for each form field.
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [term, setTerm] = useState(''); // Repayment term in months

  // This function will handle the API call.
  const handleSubmitApplication = async () => {
    // Simple validation to ensure fields are not empty.
    if (!amount || !purpose || !term) {
      Alert.alert('Incomplete Form', 'Please fill out all fields.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Authentication Error', 'You must be logged in to apply.');
        return;
      }

      // 2. Send the form data to our backend endpoint.
      await axios.post('http://192.168.1.222:5001/api/loans/apply', 
        {
          // The backend expects these keys: amount, purpose, term.
          amount: parseFloat(amount), // Convert amount to a number
          purpose: purpose,
          term: parseInt(term, 10), // Convert term to an integer
        },
        {
          headers: { 'x-auth-token': token },
        }
      );

      // 3. If successful, show a confirmation and go back to the home screen.
      Alert.alert(
        'Application Submitted',
        'Your loan application has been received and is pending review.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      console.error('Application submission failed:', error);
      Alert.alert('Submission Failed', 'Could not submit your application. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>New Loan Application</Text>

      {/* Amount Input */}
      <TextInput
        style={styles.input}
        placeholder="Loan Amount (e.g., 50000)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      {/* Purpose Input */}
      <TextInput
        style={styles.input}
        placeholder="Purpose (e.g., Tuition fees)"
        value={purpose}
        onChangeText={setPurpose}
      />

      {/* Term Input */}
      <TextInput
        style={styles.input}
        placeholder="Repayment Term in Months (e.g., 12)"
        value={term}
        onChangeText={setTerm}
        keyboardType="numeric"
      />

      {/* Submit Button */}
      <Button title="Submit Application" onPress={handleSubmitApplication} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#ffffff',
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 16,
  },
});

export default LoanApplicationScreen;