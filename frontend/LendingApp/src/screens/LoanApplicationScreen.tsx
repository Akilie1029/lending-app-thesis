// src/screens/LoanApplicationScreen.tsx
import React, { useState, useMemo } from "react";
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
  Alert,
  Image,
  FlatList,
  SafeAreaView,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { launchImageLibrary } from "react-native-image-picker";
import { Slider } from "@miblanchard/react-native-slider";

type UploadFile = {
  uri: string;
  fileName?: string;
  type?: string;
};

const BASE_URL = "http://192.168.1.222:5001";
const INTEREST_RATE = 0.2; // flat 20%
const MIN_AMOUNT = 3000;
const MAX_AMOUNT = 50000;
const AMOUNT_STEP = 500;
const DURATION_OPTIONS = [30, 35, 40];

const EMPLOYMENT_OPTIONS = [
  "Regular Employee",
  "Contractual",
  "Self-employed",
  "Business Owner",
  "Unemployed",
  "Student",
];

const INCOME_OPTIONS = [
  "₱0 - ₱10,000",
  "₱11,000 - ₱25,000",
  "₱26,000 - ₱50,000",
  "₱50,000 and above",
];

const LoanApplicationScreen: React.FC<any> = ({ navigation }) => {
  // Personal Info
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  // Employment & income (dropdowns)
  const [employment, setEmployment] = useState("");
  const [income, setIncome] = useState("");

  // Company
  const [company, setCompany] = useState("");

  // Loan fields
  const [amount, setAmount] = useState<number>(MIN_AMOUNT);
  const [duration, setDuration] = useState<number | null>(DURATION_OPTIONS[0]);
  const [purpose, setPurpose] = useState("");

  // Payout
  const [payoutMethod, setPayoutMethod] =
    useState<"gcash" | "maya" | "bank">("gcash");
  const [payoutDetails, setPayoutDetails] = useState({
    account: "",
    name: "",
    bank: "",
  });

  // Uploads: order -> ID, Selfie-with-ID, Proof
  const [idFile, setIdFile] = useState<UploadFile | null>(null);
  const [selfieFile, setSelfieFile] = useState<UploadFile | null>(null);
  const [proofFile, setProofFile] = useState<UploadFile | null>(null);

  // UI
  const [loading, setLoading] = useState(false);

  // modal controls (A3: full screen modal dropdown)
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<"employment" | "income" | null>(
    null
  );

  // Derived calculations
  const principal = amount;
  const interest = useMemo(
    () => Number((principal * INTEREST_RATE).toFixed(2)),
    [principal]
  );
  const totalPayable = useMemo(
    () => Number((principal + interest).toFixed(2)),
    [principal, interest]
  );
  const dailyPayment = useMemo(
    () => (duration && duration > 0 ? Number((totalPayable / duration).toFixed(2)) : 0),
    [totalPayable, duration]
  );

  // ---------------- file picker ----------------
  const pickFile = async (setter: (f: UploadFile) => void) => {
    try {
      const res = await launchImageLibrary({ mediaType: "photo", quality: 0.8 });
      if (!res.didCancel && res.assets?.[0]) {
        const a = res.assets[0];
        setter({
          uri: a.uri || "",
          fileName: a.fileName,
          type: a.type,
        });
      }
    } catch (err) {
      console.log("pickFile error", err);
      Alert.alert("Error", "Unable to pick file");
    }
  };

  // ---------------- age validation (exact Y/M/D) ----------------
  const handleDobChange = (txt: string) => {
    // allow typing with digits only; format as YYYY-MM-DD
    let clean = txt.replace(/\D/g, "").slice(0, 8);
    if (clean.length > 4 && clean.length <= 6) clean = clean.slice(0, 4) + "-" + clean.slice(4);
    else if (clean.length > 6) clean = clean.slice(0, 4) + "-" + clean.slice(4, 6) + "-" + clean.slice(6);
    setDob(clean);

    // validate exact age when format complete (YYYY-MM-DD -> length 10)
    if (clean.length === 10) {
      const parts = clean.split("-");
      if (parts.length !== 3) return;
      const [yStr, mStr, dStr] = parts;
      const year = Number(yStr);
      const month = Number(mStr) - 1; // JS month 0-index
      const day = Number(dStr);

      const birth = new Date(year, month, day);
      if (isNaN(birth.getTime())) {
        // invalid date
        Alert.alert("Invalid date", "Please enter a valid date of birth (YYYY-MM-DD).");
        setDob("");
        return;
      }

      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }

      if (age < 18) {
        Alert.alert("Age Restriction", "Borrower must be at least 18 years old.");
        setDob("");
      }
    }
  };

  // ---------------- phone format ----------------
  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
  };

  // ---------------- modal helpers ----------------
  const openModal = (type: "employment" | "income") => {
    setModalType(type);
    setModalVisible(true);
  };

  const selectModalOption = (opt: string) => {
    if (modalType === "employment") setEmployment(opt);
    if (modalType === "income") setIncome(opt);
    setModalVisible(false);
    setModalType(null);
  };

  // ---------------- submit ----------------
  const submitApplication = async () => {
    if (!fullName || !phone || !address) {
      Alert.alert("Missing Info", "Please fill basic personal information.");
      return;
    }

    if (!dob) {
      Alert.alert("Missing Info", "Please enter date of birth.");
      return;
    }

    if (!employment) {
      Alert.alert("Missing Info", "Please choose employment status.");
      return;
    }

    if (!income) {
      Alert.alert("Missing Info", "Please choose monthly income range.");
      return;
    }

    if (!purpose) {
      Alert.alert("Missing Info", "Please enter loan purpose.");
      return;
    }

    // require all three documents
    if (!idFile || !selfieFile || !proofFile) {
      Alert.alert("Missing Documents", "Please upload Government ID, Selfie (holding ID), and Proof of Income.");
      return;
    }

    if (!duration || !DURATION_OPTIONS.includes(duration)) {
      Alert.alert("Invalid duration", "Choose a valid repayment duration.");
      return;
    }

    if (principal < MIN_AMOUNT || principal > MAX_AMOUNT) {
      Alert.alert("Invalid amount", `Amount must be between ₱${MIN_AMOUNT} and ₱${MAX_AMOUNT}.`);
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Authentication Error", "User not logged in.");
        setLoading(false);
        return;
      }

      // As before: we send local URIs for now. Backend should handle uploads if needed later.
      const payload = {
        full_name: fullName,
        date_of_birth: dob,
        address,
        phone_number: "+63" + phone,
        employment_status: employment,
        company_name: company,
        monthly_income_range: income,
        principal,
        days: duration,
        purpose,
        payout_method: payoutMethod,
        payout_details: payoutDetails,
        government_id_local_uri: idFile?.uri,
        selfie_with_id_local_uri: selfieFile?.uri,
        proof_of_funds_local_uri: proofFile?.uri,
      };

      console.log("Submitting application payload:", payload);

      const res = await fetch(`${BASE_URL}/api/loans/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      console.log("Raw response:", text);

      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        const errMsg = data?.error || data?.message || "Loan submission failed.";
        Alert.alert("Error", errMsg);
      } else {
        Alert.alert("Success", "Loan application submitted!", [
          {
            text: "OK",
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [{ name: "Home" }],
              }),
          },
        ]);
      }
    } catch (err) {
      console.error("Submission error:", err);
      Alert.alert("Error", "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- render modal content ----------------
  const renderModal = () => {
    if (!modalType) return null;
    const data = modalType === "employment" ? EMPLOYMENT_OPTIONS : INCOME_OPTIONS;
    return (
      <Modal visible={modalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={modalStyles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={modalStyles.title}>{modalType === "employment" ? "Select Employment Status" : "Select Monthly Income"}</Text>
            <View style={{ width: 60 }} />
          </View>

          <FlatList
            data={data}
            keyExtractor={(it) => it}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => selectModalOption(item)}
                style={modalStyles.option}
              >
                <Text style={modalStyles.optionText}>{item}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#eee" }} />}
          />
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#00AEEF", "#0087D1"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <View style={styles.hamburger}>
            <View style={styles.hamLine} />
            <View style={styles.hamLine} />
            <View style={styles.hamLine} />
          </View>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Apply for Loan</Text>
        <Text style={styles.headerSubtitle}>Choose amount & repayment days</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Personal Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <TextInput
            placeholder="Full Name"
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
          />

          <TextInput
            placeholder="Date of Birth (YYYY-MM-DD)"
            style={styles.input}
            value={dob}
            onChangeText={handleDobChange}
            keyboardType="number-pad"
          />

          <TextInput
            placeholder="Home Address"
            style={styles.input}
            value={address}
            onChangeText={setAddress}
          />

          <View style={[styles.input, { flexDirection: "row", alignItems: "center" }]}>
            <Text style={{ color: "#666", marginRight: 4 }}>+63</Text>
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

        {/* Source of Funds (employment, income, company) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Source of Funds</Text>

          {/* Employment - full screen modal */}
          <TouchableOpacity style={styles.selectorInput} onPress={() => openModal("employment")}>
            <Text style={{ color: employment ? "#000" : "#9aa9b2" }}>
              {employment || "Select Employment Status"}
            </Text>
          </TouchableOpacity>

          {/* Monthly Income - full screen modal */}
          <TouchableOpacity style={styles.selectorInput} onPress={() => openModal("income")}>
            <Text style={{ color: income ? "#000" : "#9aa9b2" }}>
              {income || "Select Monthly Income Range"}
            </Text>
          </TouchableOpacity>

          <TextInput
            placeholder="Company / Business Name"
            style={styles.input}
            value={company}
            onChangeText={setCompany}
          />
        </View>

        {/* Loan Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Loan Details</Text>

          <Text style={{ marginBottom: 8 }}>Desired Amount</Text>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontWeight: "900", fontSize: 22, color: "#0077C8" }}>
              ₱ {amount.toLocaleString()}
            </Text>

            <Slider
              value={amount}
              minimumValue={MIN_AMOUNT}
              maximumValue={MAX_AMOUNT}
              step={AMOUNT_STEP}
              onValueChange={(v: any) => {
                // slider returns array from miblanchard lib
                if (Array.isArray(v)) setAmount(Number(v[0]));
                else setAmount(Number(v));
              }}
              containerStyle={{ width: "100%" }}
            />

            <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
              <Text>₱{MIN_AMOUNT}</Text>
              <Text>₱{MAX_AMOUNT}</Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ marginBottom: 6 }}>Repayment Term (days)</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {DURATION_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDuration(d)}
                  style={[
                    styles.durationOption,
                    duration === d ? { backgroundColor: "#0077C8" } : { backgroundColor: "#f3f8fb" },
                  ]}
                >
                  <Text style={{ color: duration === d ? "#fff" : "#0077C8", fontWeight: "700" }}>
                    {d} days
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TextInput
            placeholder="Reason for Loan"
            style={[styles.input, { height: 80 }]}
            value={purpose}
            onChangeText={setPurpose}
            multiline
          />

          {/* Disbursement */}
          <View style={{ marginTop: 8 }}>
            <Text style={{ marginBottom: 6 }}>Disbursement Method</Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <TouchableOpacity onPress={() => setPayoutMethod("gcash")} style={[styles.payoutBtn, payoutMethod === "gcash" ? { borderColor: "#0077C8", borderWidth: 2 } : {}]}>
                <Text style={{ fontWeight: "700" }}>GCash</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setPayoutMethod("maya")} style={[styles.payoutBtn, payoutMethod === "maya" ? { borderColor: "#0077C8", borderWidth: 2 } : {}]}>
                <Text style={{ fontWeight: "700" }}>Maya</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setPayoutMethod("bank")} style={[styles.payoutBtn, payoutMethod === "bank" ? { borderColor: "#0077C8", borderWidth: 2 } : {}]}>
                <Text style={{ fontWeight: "700" }}>Bank</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 8 }}>
              <TextInput
                placeholder="Account / Mobile Number"
                style={styles.input}
                value={payoutDetails.account}
                onChangeText={(t) => setPayoutDetails({ ...payoutDetails, account: t })}
              />

              {payoutMethod === "bank" && (
                <TextInput
                  placeholder="Bank Name"
                  style={styles.input}
                  value={payoutDetails.bank}
                  onChangeText={(t) => setPayoutDetails({ ...payoutDetails, bank: t })}
                />
              )}

              <TextInput
                placeholder="Account / Beneficiary Name"
                style={styles.input}
                value={payoutDetails.name}
                onChangeText={(t) => setPayoutDetails({ ...payoutDetails, name: t })}
              />
            </View>
          </View>

          <View style={styles.calcBox}>
            <Text style={styles.calcTitle}>Loan Summary</Text>
            <Text>Principal: ₱ {principal.toLocaleString()}</Text>
            <Text>Total Interest (20%): ₱ {interest.toLocaleString()}</Text>
            <Text>Total Repayable: ₱ {totalPayable.toLocaleString()}</Text>
            <Text>Repayment Term: {duration} days</Text>
            <Text style={{ fontWeight: "700", marginTop: 6 }}>Daily Payment: ₱ {dailyPayment.toFixed(2)}</Text>
            <Text style={{ marginTop: 6, color: "#666", fontSize: 12 }}>Note: ₱1,000 late fee applied after 2 consecutive missed days.</Text>
          </View>
        </View>

        {/* Required Documents (order: ID -> Selfie -> Proof) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Required Documents</Text>

          {/* Government ID */}
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickFile(setIdFile)}>
            <Text style={styles.uploadText}>{idFile ? "Change Government ID" : "Upload Government ID"}</Text>
          </TouchableOpacity>
          {idFile && <Image source={{ uri: idFile.uri }} style={styles.previewImage} />}

          {/* Selfie while holding ID */}
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickFile(setSelfieFile)}>
            <Text style={styles.uploadText}>{selfieFile ? "Change Selfie (with ID)" : "Upload Selfie (holding ID)"}</Text>
          </TouchableOpacity>
          {selfieFile && <Image source={{ uri: selfieFile.uri }} style={styles.previewImage} />}

          {/* Proof of Income */}
          <TouchableOpacity style={styles.uploadBtn} onPress={() => pickFile(setProofFile)}>
            <Text style={styles.uploadText}>{proofFile ? "Change Proof of Income" : "Upload Proof of Income"}</Text>
          </TouchableOpacity>
          {proofFile && <Image source={{ uri: proofFile.uri }} style={styles.previewImage} />}
        </View>

        {/* Submit */}
        <TouchableOpacity style={styles.submitBtn} onPress={submitApplication} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Application</Text>}
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* modal full screen dropdown */}
      {renderModal()}
    </View>
  );
};

const modalStyles = StyleSheet.create({
  header: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  cancel: { color: "#0077C8", fontWeight: "700" },
  title: { fontWeight: "700", fontSize: 16 },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  optionText: {
    fontSize: 16,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  hamburger: { marginBottom: 10 },
  hamLine: {
    width: 22,
    height: 3,
    backgroundColor: "#fff",
    marginVertical: 2,
    borderRadius: 2,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "700" },
  headerSubtitle: { color: "#eaf8ff", fontSize: 13, marginTop: 6 },
  scroll: { padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },
  sectionTitle: { fontWeight: "700", fontSize: 15, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#cfeefc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  selectorInput: {
    borderWidth: 1,
    borderColor: "#cfeefc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  calcBox: {
    backgroundColor: "#f3faff",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  calcTitle: { fontWeight: "700", marginBottom: 6 },
  uploadBtn: {
    backgroundColor: "#e0f3ff",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  uploadText: { color: "#0077C8", fontWeight: "600" },
  previewImage: { width: "100%", height: 150, borderRadius: 8, marginBottom: 10 },
  submitBtn: {
    backgroundColor: "#0077C8",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  durationOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 92,
    alignItems: "center",
  },
  payoutBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f3f8fb",
    minWidth: 84,
    alignItems: "center",
  },
});

export default LoanApplicationScreen;
