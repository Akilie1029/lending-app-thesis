// src/screens/RepayLoanScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useRoute, useNavigation } from "@react-navigation/native";

const API_BASE = "http://192.168.1.222:5001/api";

export default function RepayLoanScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const loan = route.params?.loan;

  const [loading, setLoading] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankAccount, setBankAccount] = useState("");
  const [showProcessing, setShowProcessing] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");

  if (!loan) {
    return (
      <View style={styles.centered}>
        <Text>No loan selected.</Text>
      </View>
    );
  }

  const daily = Number(loan.daily_payment ?? loan.total_payable ?? 0);
  const remaining = Number(loan.remaining_balance ?? loan.total_payable ?? 0);

  const amountToPay = () => {
    // prefer custom amount if valid positive number, else daily
    const parsed = Number(customAmount);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return daily;
  };

  const payViaApi = async (method: string, payload: any = {}) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("userToken");
      const res = await axios.post(
        `${API_BASE}/loans/${loan.id}/pay`,
        {
          amount: payload.amount ?? amountToPay(),
          method,
          metadata: payload.metadata ?? {},
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // backend should return updated loan or success
      const updatedLoan = res.data?.loan ?? res.data;
      setLoading(false);

      Alert.alert("Payment successful", "Payment recorded.", [
        {
          text: "OK",
          onPress: () => {
            // navigate home or to loan details
            navigation.reset({
              index: 0,
              routes: [{ name: "Home" }],
            } as any);
          },
        },
      ]);
    } catch (err: any) {
      console.error("Pay error", err?.response?.data || err.message);
      setLoading(false);
      Alert.alert(
        "Payment failed",
        err?.response?.data?.message || "Unable to complete payment."
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f6f7fb" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Repay Loan</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      <View style={styles.container}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Remaining Balance</Text>
          <Text style={styles.summaryAmount}>₱ {remaining.toLocaleString()}</Text>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.small}>Daily Payment</Text>
            <Text style={styles.daily}>₱ {daily.toLocaleString()}</Text>
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={styles.small}>Next Due</Text>
            <Text style={styles.small}>
              {loan.latest_due_date
                ? new Date(loan.latest_due_date).toLocaleDateString()
                : "N/A"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Choose Payment Method</Text>

        {/* Methods - two per row */}
        <View style={styles.methodRow}>
          <TouchableOpacity
            style={styles.methodCard}
            onPress={() => navigation.navigate("GCashPay", { loan, amount: amountToPay() })}
          >
            <Icon name="phone-portrait" size={28} color="#0077C8" />
            <Text style={styles.methodTitle}>GCash</Text>
            <Text style={styles.methodSub}>Pay with GCash</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.methodCard}
            onPress={() => navigation.navigate("MayaPay", { loan, amount: amountToPay() })}
          >
            <Icon name="wallet" size={28} color="#8A2BE2" />
            <Text style={styles.methodTitle}>Maya</Text>
            <Text style={styles.methodSub}>Pay with Maya</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.methodRow}>
          <TouchableOpacity
            style={styles.methodCard}
            onPress={() => setShowBankForm(true)}
          >
            <Icon name="md-bank" size={28} color="#0077C8" />
            <Text style={styles.methodTitle}>Bank Transfer</Text>
            <Text style={styles.methodSub}>Select bank & submit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.methodCard}
            onPress={() => navigation.navigate("CardPay", { loan, amount: amountToPay() })}
          >
            <Icon name="card" size={28} color="#0077C8" />
            <Text style={styles.methodTitle}>Debit / Credit</Text>
            <Text style={styles.methodSub}>Visa / Mastercard</Text>
          </TouchableOpacity>
        </View>

        {/* custom amount input */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: "#666", marginBottom: 6 }}>Pay a different amount</Text>
          <TextInput
            placeholder={`Leave empty to pay daily ₱${daily.toLocaleString()}`}
            keyboardType="numeric"
            value={customAmount}
            onChangeText={setCustomAmount}
            style={styles.customInput}
          />
        </View>

        {/* Bank inline form modal */}
        <Modal visible={showBankForm} animationType="slide">
          <View style={styles.modalWrap}>
            <Text style={styles.modalTitle}>Bank Transfer</Text>

            {/* simple static bank list */}
            {["BDO", "BPI", "Landbank", "Metrobank", "PNB"].map((b) => (
              <TouchableOpacity
                key={b}
                style={[
                  styles.bankOption,
                  selectedBank === b ? { borderColor: "#169AF9", borderWidth: 2 } : {},
                ]}
                onPress={() => setSelectedBank(b)}
              >
                <Text style={{ fontWeight: "700" }}>{b}</Text>
              </TouchableOpacity>
            ))}

            <View style={{ marginTop: 8 }}>
              <Text style={{ marginBottom: 4, color: "#666" }}>Account / Reference</Text>
              <TextInput
                placeholder="Enter account or transaction reference"
                value={bankAccount}
                onChangeText={setBankAccount}
                style={[styles.input, { marginBottom: 8 }]}
              />
            </View>

            <View style={{ height: 12 }} />

            <TouchableOpacity
              style={[styles.primaryButton, { alignSelf: "stretch" }]}
              onPress={() => {
                if (!selectedBank) {
                  Alert.alert("Select bank", "Please choose a bank.");
                  return;
                }
                setShowProcessing(true);
                // simulate flow then call backend
                setTimeout(async () => {
                  setShowProcessing(false);
                  // call backend add payment
                  await payViaApi("bank", {
                    amount: amountToPay(),
                    metadata: { bank: selectedBank, account: bankAccount },
                  });
                }, 1000);
              }}
            >
              <Text style={styles.primaryButtonText}>Submit Bank Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 10 }]}
              onPress={() => setShowBankForm(false)}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={showProcessing} transparent animationType="fade">
            <View style={styles.processing}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ color: "#fff", marginTop: 8 }}>Processing...</Text>
            </View>
          </Modal>
        </Modal>

        {/* Pay now quick action - fallback */}
        <View style={{ marginTop: 20 }}>
          <TouchableOpacity
            style={[styles.primaryButton, { alignSelf: "stretch" }]}
            onPress={() =>
              Alert.alert(
                "Choose method",
                "Please choose GCash / Maya / Bank or Card to proceed."
              )
            }
          >
            <Text style={styles.primaryButtonText}>Pay Now</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.fullscreenLoader}>
            <ActivityIndicator size="large" />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 50, paddingBottom: 18, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  container: { padding: 16, flex: 1 },
  summaryCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, elevation: 3, borderWidth: 2, borderColor: "#e8f4ff" },
  summaryLabel: { color: "#666" },
  summaryAmount: { fontSize: 26, fontWeight: "900", marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  methodRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  methodCard: { backgroundColor: "#fff", padding: 12, borderRadius: 12, width: "48%", alignItems: "center", elevation: 2, borderWidth: 1, borderColor: "#eaf6ff" },
  methodTitle: { fontWeight: "700", marginTop: 8 },
  methodSub: { color: "#666", fontSize: 12 },
  small: { color: "#666", fontSize: 12 },
  daily: { fontSize: 20, fontWeight: "800", marginTop: 4 },
  modalWrap: { padding: 16, flex: 1, backgroundColor: "#f6f7fb" },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  bankOption: { padding: 12, borderRadius: 8, backgroundColor: "#fff", marginBottom: 8, borderWidth: 1, borderColor: "#eee" },
  input: { padding: 12, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee" },
  primaryButton: { backgroundColor: "#169AF9", padding: 14, borderRadius: 10, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: { borderWidth: 1.5, borderColor: "#169AF9", padding: 12, borderRadius: 10, alignItems: "center" },
  secondaryButtonText: { color: "#169AF9", fontWeight: "700" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  processing: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  fullscreenLoader: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.5)" },
  customInput: { backgroundColor: "#fff", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#eee" },
});
 