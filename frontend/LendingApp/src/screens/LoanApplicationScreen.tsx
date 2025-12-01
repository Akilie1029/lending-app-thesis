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
  Alert,
  Image,
  FlatList,
  SafeAreaView,
  Pressable,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { launchImageLibrary } from "react-native-image-picker";
import { Slider } from "@miblanchard/react-native-slider";
import api from "../services/api";
import { API_BASE } from "../config";

type UploadFile = {
  uri: string;
  fileName?: string;
  type?: string;
};

// Loan constants
const INTEREST_RATE = 0.2;
const MIN_AMOUNT = 3000;
const MAX_AMOUNT = 50000;
const AMOUNT_STEP = 500;
const DURATION_OPTIONS = [30, 35, 40];

// Dropdown options
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

export default function LoanApplicationScreen({ navigation }: any) {
  // Personal Info
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  // Employment
  const [employment, setEmployment] = useState("");
  const [income, setIncome] = useState("");
  const [company, setCompany] = useState("");

  // Loan
  const [amount, setAmount] = useState(MIN_AMOUNT);
  const [duration, setDuration] = useState(DURATION_OPTIONS[0]);
  const [purpose, setPurpose] = useState("");

  // Payout
  const [payoutMethod, setPayoutMethod] =
    useState<"gcash" | "maya" | "bank">("gcash");

  const [payoutDetails, setPayoutDetails] = useState({
    account: "",
    name: "",
    bank: "",
  });

  // Document Uploads
  const [idFile, setIdFile] = useState<UploadFile | null>(null);
  const [selfieFile, setSelfieFile] = useState<UploadFile | null>(null);
  const [proofFile, setProofFile] = useState<UploadFile | null>(null);

  // UI
  const [loading, setLoading] = useState(false);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] =
    useState<"employment" | "income" | null>(null);

  // Calculations
  const principal = amount;
  const interest = useMemo(() => Number((principal * INTEREST_RATE).toFixed(2)), [principal]);
  const totalPayable = useMemo(() => Number((principal + interest).toFixed(2)), [principal, interest]);
  const dailyPayment = useMemo(
    () => Number((totalPayable / duration).toFixed(2)),
    [duration, totalPayable]
  );

  // --------------------------------------------------------------------
  // PICK FILE HELPER
  // --------------------------------------------------------------------
  const pickFile = async (setter: (f: UploadFile) => void) => {
    try {
      const res = await launchImageLibrary({
        mediaType: "photo",
        quality: 0.85,
      });

      if (!res.didCancel && res.assets?.[0]) {
        const a = res.assets[0];
        setter({ uri: a.uri!, fileName: a.fileName, type: a.type });
      }
    } catch (err) {
      Alert.alert("Error", "Unable to pick file.");
    }
  };

  // --------------------------------------------------------------------
// UPLOAD FILE TO BACKEND (Cloudinary via API)
// --------------------------------------------------------------------
const uploadDocument = async (uri: string, endpoint: string) => {
  const form = new FormData();
  form.append("file", {
    uri,
    type: "image/jpeg",
    name: `upload_${Date.now()}.jpg`,
  } as any);

  const token = await AsyncStorage.getItem("userToken");

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
    body: form,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Upload failed");
  }

  return json; // contains { url, public_id }
};


  // --------------------------------------------------------------------
  // DOB INPUT
  // --------------------------------------------------------------------
  const handleDobChange = (txt: string) => {
    let clean = txt.replace(/\D/g, "").slice(0, 8);

    if (clean.length > 4 && clean.length <= 6)
      clean = clean.slice(0, 4) + "-" + clean.slice(4);
    else if (clean.length > 6)
      clean = clean.slice(0, 4) + "-" + clean.slice(4, 6) + "-" + clean.slice(6);

    setDob(clean);

    if (clean.length === 10) {
      const [Y, M, D] = clean.split("-").map(Number);
      const birth = new Date(Y, M - 1, D);
      if (isNaN(birth.getTime())) {
        Alert.alert("Invalid Date", "Enter a valid date (YYYY-MM-DD)");
        setDob("");
        return;
      }

      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      if (
        now.getMonth() < birth.getMonth() ||
        (now.getMonth() === birth.getMonth() &&
          now.getDate() < birth.getDate())
      )
        age--;

      if (age < 18) {
        Alert.alert("Age Restriction", "You must be at least 18 years old.");
        setDob("");
      }
    }
  };

  // --------------------------------------------------------------------
  // PHONE NUMBER
  // --------------------------------------------------------------------
  const handlePhoneChange = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 10);
    setPhone(digits);
  };

  // --------------------------------------------------------------------
  // MODAL HANDLING
  // --------------------------------------------------------------------
  const openModal = (type: "employment" | "income") => {
    setModalType(type);
    setModalVisible(true);
  };

  const selectOption = (opt: string) => {
    if (modalType === "employment") setEmployment(opt);
    if (modalType === "income") setIncome(opt);
    setModalVisible(false);
    setModalType(null);
  };

  // --------------------------------------------------------------------
  // SUBMIT APPLICATION
  // --------------------------------------------------------------------
const submitApplication = async () => {
  if (!fullName || !dob || !address || phone.length < 10) {
    Alert.alert("Missing Info", "Please complete all personal details.");
    return;
  }

  if (!employment) return Alert.alert("Error", "Select employment status.");
  if (!income) return Alert.alert("Error", "Select income range.");
  if (!purpose) return Alert.alert("Error", "Enter loan purpose.");

  if (!idFile || !selfieFile || !proofFile) {
    return Alert.alert("Documents Missing", "All documents are required.");
  }

  setLoading(true);

  try {
    // 1️⃣ UPLOAD ID
    const idUpload = await uploadDocument(idFile.uri, "/upload/valid-id");

    // 2️⃣ UPLOAD SELFIE
    const selfieUpload = await uploadDocument(
      selfieFile.uri,
      "/upload/id-selfie"
    );

    // 3️⃣ UPLOAD PROOF OF INCOME
    const proofUpload = await uploadDocument(
      proofFile.uri,
      "/upload/proof-income"
    );

    // 4️⃣ SEND LOAN APPLICATION
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

      // URLs returned by backend upload routes
      valid_id_url: idUpload.url,
      selfie_id_url: selfieUpload.url,
      proof_income_url: proofUpload.url,
    };

    const res = await api.post("/loans/apply", payload);

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
  } catch (err: any) {
    console.error("Loan apply error:", err);
    Alert.alert("Failed", err?.message || "Loan application failed.");
  } finally {
    setLoading(false);
  }
};

  // --------------------------------------------------------------------
  // MODAL RENDER
  // --------------------------------------------------------------------
  const renderModal = () => {
    if (!modalType) return null;

    const list = modalType === "employment" ? EMPLOYMENT_OPTIONS : INCOME_OPTIONS;

    return (
      <Modal visible={modalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={modalStyles.header}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={modalStyles.cancel}>Cancel</Text>
            </TouchableOpacity>

            <Text style={modalStyles.title}>
              {modalType === "employment"
                ? "Select Employment Status"
                : "Select Monthly Income"}
            </Text>

            <View style={{ width: 60 }} />
          </View>

          <FlatList
            data={list}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => selectOption(item)}>
                <View style={modalStyles.option}>
                  <Text style={modalStyles.optionText}>{item}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    );
  };

  // --------------------------------------------------------------------
  // MAIN UI
  // --------------------------------------------------------------------
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
        <Text style={styles.headerSubtitle}>
          Choose amount & repayment days
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* PERSONAL INFO */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <TextInput
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
          />

          <TextInput
            placeholder="Date of Birth (YYYY-MM-DD)"
            value={dob}
            onChangeText={handleDobChange}
            keyboardType="number-pad"
            style={styles.input}
          />

          <TextInput
            placeholder="Home Address"
            value={address}
            onChangeText={setAddress}
            style={styles.input}
          />

          <View style={[styles.input, styles.phoneRow]}>
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

        {/* EMPLOYMENT INFO */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Source of Funds</Text>

          <TouchableOpacity
            style={styles.selectorInput}
            onPress={() => openModal("employment")}
          >
            <Text style={{ color: employment ? "#000" : "#9aa9b2" }}>
              {employment || "Select Employment Status"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.selectorInput}
            onPress={() => openModal("income")}
          >
            <Text style={{ color: income ? "#000" : "#9aa9b2" }}>
              {income || "Select Monthly Income"}
            </Text>
          </TouchableOpacity>

          <TextInput
            placeholder="Company / Business Name"
            value={company}
            onChangeText={setCompany}
            style={styles.input}
          />
        </View>

        {/* LOAN DETAILS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Loan Details</Text>

          {/* Amount */}
          <Text style={{ marginBottom: 8 }}>Desired Amount</Text>

          <Text style={styles.loanAmountText}>
            ₱ {amount.toLocaleString()}
          </Text>

          <Slider
            value={amount}
            minimumValue={MIN_AMOUNT}
            maximumValue={MAX_AMOUNT}
            step={AMOUNT_STEP}
            onValueChange={(v: any) =>
              setAmount(Number(Array.isArray(v) ? v[0] : v))
            }
          />

          <View style={styles.amountRange}>
            <Text>₱{MIN_AMOUNT}</Text>
            <Text>₱{MAX_AMOUNT}</Text>
          </View>

          {/* Duration */}
          <Text style={{ marginBottom: 6, marginTop: 12 }}>Repayment Days</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDuration(d)}
                style={[
                  styles.durationOption,
                  duration === d && styles.durationActive,
                ]}
              >
                <Text
                  style={{
                    color: duration === d ? "#fff" : "#0077C8",
                    fontWeight: "700",
                  }}
                >
                  {d} days
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Purpose */}
          <TextInput
            placeholder="Reason for Loan"
            value={purpose}
            onChangeText={setPurpose}
            style={[styles.input, { height: 80 }]}
            multiline
          />

          {/* PAYOUT METHOD */}
          <Text style={{ marginTop: 12, marginBottom: 6 }}>
            Payout Method
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {["gcash", "maya", "bank"].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setPayoutMethod(m as any)}
                style={[
                  styles.payoutBtn,
                  payoutMethod === m && styles.payoutActive,
                ]}
              >
                <Text style={{ fontWeight: "700" }}>{m.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            placeholder="Account / Mobile Number"
            value={payoutDetails.account}
            onChangeText={(t) =>
              setPayoutDetails({ ...payoutDetails, account: t })
            }
            style={styles.input}
          />

          {payoutMethod === "bank" && (
            <TextInput
              placeholder="Bank Name"
              value={payoutDetails.bank}
              onChangeText={(t) =>
                setPayoutDetails({ ...payoutDetails, bank: t })
              }
              style={styles.input}
            />
          )}

          <TextInput
            placeholder="Account / Beneficiary Name"
            value={payoutDetails.name}
            onChangeText={(t) =>
              setPayoutDetails({ ...payoutDetails, name: t })
            }
            style={styles.input}
          />

          {/* SUMMARY */}
          <View style={styles.calcBox}>
            <Text style={styles.calcTitle}>Loan Summary</Text>
            <Text>Principal: ₱ {principal.toLocaleString()}</Text>
            <Text>Interest (20%): ₱ {interest.toLocaleString()}</Text>
            <Text>Total Payable: ₱ {totalPayable.toLocaleString()}</Text>
            <Text>Duration: {duration} days</Text>

            <Text style={styles.dailyText}>
              Daily Payment: ₱ {dailyPayment.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* DOCUMENTS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Required Documents</Text>

          {/* ID */}
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => pickFile(setIdFile)}
          >
            <Text style={styles.uploadText}>
              {idFile ? "Change ID" : "Upload Government ID"}
            </Text>
          </TouchableOpacity>
          {idFile && <Image source={{ uri: idFile.uri }} style={styles.previewImage} />}

          {/* Selfie */}
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => pickFile(setSelfieFile)}
          >
            <Text style={styles.uploadText}>
              {selfieFile ? "Change Selfie (with ID)" : "Upload Selfie (with ID)"}
            </Text>
          </TouchableOpacity>
          {selfieFile && (
            <Image source={{ uri: selfieFile.uri }} style={styles.previewImage} />
          )}

          {/* Proof */}
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => pickFile(setProofFile)}
          >
            <Text style={styles.uploadText}>
              {proofFile ? "Change Proof of Income" : "Upload Proof of Income"}
            </Text>
          </TouchableOpacity>
          {proofFile && (
            <Image source={{ uri: proofFile.uri }} style={styles.previewImage} />
          )}
        </View>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={submitApplication}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit Application</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>

      {renderModal()}
    </View>
  );
}

/* ---------------- MODAL STYLES ---------------- */
const modalStyles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 16,
  },
  cancel: { color: "#0077C8", fontWeight: "700" },
  title: { fontWeight: "700", fontSize: 16 },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  optionText: { fontSize: 16 },
});

/* ---------------- MAIN STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },

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

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  selectorInput: {
    borderWidth: 1,
    borderColor: "#cfeefc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },

  loanAmountText: {
    fontWeight: "900",
    fontSize: 22,
    color: "#0077C8",
    textAlign: "center",
    marginVertical: 4,
  },

  amountRange: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 6,
  },

  durationOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#f3f8fb",
    minWidth: 92,
    alignItems: "center",
  },
  durationActive: {
    backgroundColor: "#0077C8",
  },

  payoutBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f3f8fb",
    minWidth: 84,
    alignItems: "center",
  },
  payoutActive: {
    borderColor: "#0077C8",
    borderWidth: 2,
  },

  calcBox: {
    backgroundColor: "#f3faff",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },

  calcTitle: { fontWeight: "700", marginBottom: 6 },

  dailyText: {
    fontWeight: "700",
    marginTop: 6,
    fontSize: 16,
  },

  uploadBtn: {
    backgroundColor: "#e0f3ff",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  uploadText: { color: "#0077C8", fontWeight: "600" },

  previewImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },

  submitBtn: {
    backgroundColor: "#0077C8",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
