import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
  Alert,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { MONTHLY_INTEREST_RATE } from '../config/loan';

const BASE_URL = 'http://192.168.1.222:5001'; // 👈 local backend

interface UploadFile {
  uri: string;
  fileName?: string;
  type?: string;
}

const LoanApplicationScreen: React.FC<any> = ({ navigation }) => {
  // --- Personal Info ---
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // --- Employment ---
  const [employment, setEmployment] = useState('');
  const [company, setCompany] = useState('');
  const [income, setIncome] = useState('');

  // --- Loan ---
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [showDurationModal, setShowDurationModal] = useState(false);

  // --- Uploads ---
  const [proofFile, setProofFile] = useState<UploadFile | null>(null);
  const [idFile, setIdFile] = useState<UploadFile | null>(null);

  // --- UI State ---
  const [loading, setLoading] = useState(false);

  // --- Loan Calculations ---
  const INTEREST = MONTHLY_INTEREST_RATE;
  const months = duration || 0;
  const principal = parseFloat(amount) || 0;
  const totalInterest = principal * INTEREST * months;
  const totalPayable = principal + totalInterest;
  const monthlyPayment = months > 0 ? totalPayable / months : 0;

  // ============================================================
  // 📱 Phone input auto-format
  // ============================================================
  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  // ============================================================
  // 🎂 DOB Input Validation
  // ============================================================
  const handleDobChange = (text: string) => {
    let clean = text.replace(/\D/g, '').slice(0, 8);
    if (clean.length > 4 && clean.length <= 6) clean = clean.slice(0, 4) + '-' + clean.slice(4);
    else if (clean.length > 6) clean = clean.slice(0, 4) + '-' + clean.slice(4, 6) + '-' + clean.slice(6);
    setDob(clean);
  };

  // ============================================================
  // 📎 Upload Helpers (local only)
  // ============================================================
  const pickFile = async (setter: (file: UploadFile) => void) => {
    const res = await launchImageLibrary({ mediaType: 'photo' });
    if (!res.didCancel && res.assets?.[0]) setter(res.assets[0]);
  };

  // ============================================================
  // 📨 Submit Loan (local URIs only)
  // ============================================================
  const submitApplication = async () => {
    if (!amount || !purpose || !duration) {
      Alert.alert('Missing Info', 'Please fill in all required fields.');
      return;
    }

    if (!idFile || !proofFile) {
      Alert.alert('Missing Documents', 'Please upload your ID and Proof of Income.');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        Alert.alert('Authentication Error', 'User not logged in.');
        setLoading(false);
        return;
      }

      const payload = {
        full_name: fullName,
        date_of_birth: dob,
        address,
        phone_number: '+63' + phone,
        employment_status: employment,
        company_name: company,
        monthly_income: parseFloat(income),
        amount_requested: parseFloat(amount),
        purpose,
        repayment_term_months: duration,
        // just local URIs for now
        proof_of_funds_local_uri: proofFile.uri,
        government_id_local_uri: idFile.uri,
      };

      console.log('Submitting application payload:', payload);

      const res = await fetch(`${BASE_URL}/api/loans/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      console.log('Raw response:', text);

if (!res.ok) {
  Alert.alert('Error', data.error || 'Loan submission failed.');
} else {
  Alert.alert(
    'Success',
    'Your loan application was submitted successfully!',
    [
      {
        text: 'OK',
        onPress: () => navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        }),
      },
    ]
  );
}

    } catch (err) {
      console.error('Submission error:', err);
      Alert.alert('Error', 'Unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#00AEEF', '#0087D1']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <View style={styles.hamburger}>
            <View style={styles.hamLine} />
            <View style={styles.hamLine} />
            <View style={styles.hamLine} />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Apply for Loan</Text>
        <Text style={styles.headerSubtitle}>Fill out the form to process your loan request</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Personal Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <TextInput placeholder="Full Name" style={styles.input} value={fullName} onChangeText={setFullName} />
          <TextInput placeholder="Date of Birth (YYYY-MM-DD)" style={styles.input} value={dob} onChangeText={handleDobChange} keyboardType="numeric" />
          <TextInput placeholder="Home Address" style={styles.input} value={address} onChangeText={setAddress} />
          <View style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={{ color: '#666', marginRight: 4 }}>+63</Text>
            <TextInput
              style={{ flex: 1 }}
              placeholder="9123456789"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* Source of Funds */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Source of Funds</Text>
          <TextInput placeholder="Employment Status" style={styles.input} value={employment} onChangeText={setEmployment} />
          <TextInput placeholder="Company / Business Name" style={styles.input} value={company} onChangeText={setCompany} />
          <TextInput placeholder="Monthly Income" style={styles.input} value={income} onChangeText={setIncome} keyboardType="numeric" />
        </View>

        {/* Loan Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Loan Details</Text>
          <TextInput placeholder="Desired Amount" style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" />
          <TouchableOpacity style={styles.input} onPress={() => setShowDurationModal(true)}>
            <Text style={{ color: duration ? '#000' : '#9aa9b2' }}>
              {duration ? `${duration} Month${duration > 1 ? 's' : ''}` : 'Select Duration'}
            </Text>
          </TouchableOpacity>
          <TextInput placeholder="Reason for Loan" style={[styles.input, { height: 80 }]} value={purpose} onChangeText={setPurpose} multiline />

          {amount && duration && (
            <View style={styles.calcBox}>
              <Text style={styles.calcTitle}>Loan Calculator</Text>
              <Text>Total Payable: ₱ {totalPayable.toFixed(2)}</Text>
              <Text>Monthly Payment: ₱ {monthlyPayment.toFixed(2)}</Text>
              <Text>Total Interest: ₱ {totalInterest.toFixed(2)}</Text>
              <Text>Interest Rate: {INTEREST * 100}% per month</Text>
            </View>
          )}
        </View>

        {/* Upload Documents */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Required Documents</Text>

          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickFile(setIdFile)}>
            <Text style={styles.uploadText}>{idFile ? 'Change Government ID' : 'Upload Government ID'}</Text>
          </TouchableOpacity>
          {idFile && <Image source={{ uri: idFile.uri }} style={styles.previewImage} />}

          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickFile(setProofFile)}>
            <Text style={styles.uploadText}>{proofFile ? 'Change Proof of Income' : 'Upload Proof of Income'}</Text>
          </TouchableOpacity>
          {proofFile && <Image source={{ uri: proofFile.uri }} style={styles.previewImage} />}
        </View>

        {/* Submit */}
        <TouchableOpacity style={styles.submitBtn} onPress={submitApplication} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Application</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Duration Modal */}
      <Modal transparent visible={showDurationModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Loan Duration</Text>
            {[1, 2, 3, 4, 5, 6].map((m) => (
              <Pressable key={m} style={styles.modalOption} onPress={() => { setDuration(m); setShowDurationModal(false); }}>
                <Text style={styles.modalOptionText}>{m} Month{m > 1 ? 's' : ''}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalCancel} onPress={() => setShowDurationModal(false)}>
              <Text style={{ color: '#0077C8', fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  hamburger: { marginBottom: 10 },
  hamLine: { width: 22, height: 3, backgroundColor: '#fff', marginVertical: 2, borderRadius: 2 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerSubtitle: { color: '#eaf8ff', fontSize: 13, marginTop: 6 },
  scroll: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 14, elevation: 2 },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#cfeefc', borderRadius: 8, padding: 10, marginBottom: 10 },
  calcBox: { backgroundColor: '#f3faff', borderRadius: 8, padding: 10, marginTop: 10 },
  calcTitle: { fontWeight: '700', marginBottom: 6 },
  uploadBtn: { backgroundColor: '#e0f3ff', borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 10 },
  uploadText: { color: '#0077C8', fontWeight: '600' },
  previewImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 10 },
  submitBtn: { backgroundColor: '#0077C8', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 20 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '80%', alignItems: 'center' },
  modalTitle: { fontWeight: '700', fontSize: 16, marginBottom: 10 },
  modalOption: { paddingVertical: 10, width: '100%', alignItems: 'center' },
  modalOptionText: { fontSize: 15, color: '#333' },
  modalCancel: { marginTop: 10 },
});

export default LoanApplicationScreen;
