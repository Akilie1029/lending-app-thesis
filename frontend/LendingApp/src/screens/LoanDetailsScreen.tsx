import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';


const LoanDetailsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { loan } = route.params || {};

  if (!loan) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#777', fontSize: 16 }}>No loan details available</Text>
      </View>
    );
  }

  // --- Normalize inputs ---
  const principal = Number(loan.amount_requested) || 0;
  const months = Number(loan.repayment_term_months) || 1;

  // --- Calculate loan data (20% monthly) ---
  const monthlyRate = 0.20; // 20% per month
  const interestAmount = principal * monthlyRate * months; // simple interest over months
  const totalRepayable = principal + interestAmount;
  const monthlyPayment = totalRepayable / months;

  // Helper for formatting to exactly 2 decimal places
  const formatCurrency = (amount: number) =>
    amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* ===== HEADER ===== */}
<LinearGradient colors={['#169AF9', '#37AAF2']} style={styles.header}>
  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonContainer}>
    <Icon name="arrow-back" size={26} color="#fff" />
  </TouchableOpacity>
  <Text style={styles.headerTitle}>Loan Details</Text>
</LinearGradient>


      {/* ===== LOAN INFO CARD ===== */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Loan Summary</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Loan Amount:</Text>
          <Text style={styles.value}>₱ {formatCurrency(principal)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Interest Rate:</Text>
          <Text style={styles.value}>20% (per month)</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Interest Amount:</Text>
          <Text style={styles.value}>₱ {formatCurrency(interestAmount)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Repayment Term:</Text>
          <Text style={styles.value}>{months} month{months > 1 ? 's' : ''}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Purpose:</Text>
          <Text style={[styles.value, { flex: 1, textAlign: 'right' }]}>{loan.purpose}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Date Submitted:</Text>
          <Text style={styles.value}>
            {new Date(loan.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Status:</Text>
          <Text
            style={[
              styles.value,
              {
                color:
                  loan.status === 'approved'
                    ? '#00B050'
                    : loan.status === 'pending'
                    ? '#F39C12'
                    : '#FF3B30',
              },
            ]}
          >
            {String(loan.status).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ===== PAYMENT BREAKDOWN ===== */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Repayment Breakdown</Text>

        <Text style={styles.paragraph}>
          Interest is applied at 20% per month. The interest shown is calculated as:
        </Text>

        <Text style={styles.paragraph}>
          Interest = Principal × Monthly Rate × Number of Months
        </Text>

        <View style={[styles.row, { marginTop: 10 }]}>
          <Text style={styles.label}>Total Amount to Repay:</Text>
          <Text style={[styles.value, { color: '#0077C8' }]}>
            ₱ {formatCurrency(totalRepayable)}
          </Text>
        </View>

        <View style={[styles.row, { marginTop: 6 }]}>
          <Text style={styles.label}>Monthly Payment:</Text>
          <Text style={[styles.value, { color: '#0077C8' }]}>
            ₱ {formatCurrency(monthlyPayment)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

export default LoanDetailsScreen;

// === STYLES ===
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 20,
  },
  backButton: { fontSize: 22, color: '#fff', marginRight: 10 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginLeft: 10, },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 15,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#169AF9',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  label: { fontSize: 15, color: '#555' },
  value: { fontSize: 15, fontWeight: '700', color: '#000' },
  paragraph: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginTop: 5,
  },
});
