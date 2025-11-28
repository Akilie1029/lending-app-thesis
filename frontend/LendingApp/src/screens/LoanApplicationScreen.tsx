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
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { launchImageLibrary } from "react-native-image-picker";
import { Slider } from "@miblanchard/react-native-slider";

import { API_BASE, CLOUD_NAME, UPLOAD_PRESET } from "../config";
import { uploadToCloudinary } from "../services/uploadToCloudinary";

type UploadFile = {
  uri: string;
  fileName?: string;
  type?: string;
};

const INTEREST_RATE = 0.2;
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

export default function LoanApplicationScreen({ navigation }: any) {
  /* ---------------------- Personal Info ---------------------- */
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  /* ---------------------- Employment ------------------------- */
  const [employment, setEmployment] = useState("");
  const [income, setIncome] = useState("");
  const [company, setCompany] = useState("");

  /* ---------------------- Loan Details ------------------------ */
  const [amount, setAmount] = useState(MIN_AMOUNT);
  const [duration, setDuration] = useState<number>(DURATION_OPTIONS[0]);
  const [purpose, setPurpose] = useState("");

  /* ---------------------- Payout ------------------------------ */
  const [payoutMethod, setPayoutMethod] =
    useState<"gcash" | "maya" | "bank">("gcash");
  const [payoutDetails, setPayoutDetails] = useState({
    account: "",
    name: "",
    bank: "",
  });

  /* ---------------------- Document Uploads --------------------- */
  const [idFile, setIdFile] = useState<UploadFile | null>(null);
  const [selfieFile, setSelfieFile] = useState<UploadFile | null>(null);
  const [proofFile, setProofFile] = useState<UploadFile | null>(null);

  const [loading, setLoading] = useState(false);

  /* ---------------------- Modal ---------------------- */
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] =
    useState<"employment" | "income" | null>(null);

  /* ---------------------- Calculations ---------------------- */
  const principal = amount;
  const interest = useMemo(() => Number((principal * INTEREST_RATE).toFixed(2)), [principal]);
  const totalPayable = useMemo(() => principal + interest, [principal, interest]);
  const dailyPayment = useMemo(
    () => (duration ? Number((totalPayable / duration).toFixed(2)) : 0),
    [duration, totalPayable]
  );

  /* ---------------------- Image Picker ---------------------- */
  const pickFile = async (setter: (f: UploadFile) => void) => {
    try {
      const res = await launchImageLibrary({ mediaType: "photo", quality: 0.85 });
      if (!res.didCancel && res.assets?.[0]) {
        const a = res.assets[0];
        setter({ uri: a.uri || "", fileName: a.fileName, type: a.type });
      }
    } catch (e) {
      console.log("pickFile error", e);
      Alert.alert("Error", "Unable to pick file.");
    }
  };

  /* ---------------------- Format DOB ---------------------- */
  const handleDobChange = (txt: string) => {
    let clean = txt.replace(/\D/g, "").slice(0, 8);

    if (clean.length > 4 && clean.length <= 6) clean = clean.slice(0, 4) + "-" + clean.slice(4);
    else if (clean.length > 6) clean = clean.slice(0, 4) + "-" + clean.slice(4, 6) + "-" + clean.slice(6);

    setDob(clean);
  };

  /* ---------------------- Format Phone ---------------------- */
  const handlePhoneChange = (txt: string) => {
    setPhone(txt.replace(/\D/g, "").slice(0, 10));
  };

  /* ---------------------- Modal ---------------------- */
  const openModal = (type: "employment" | "income") => {
    setModalType(type);
    setModalVisible(true);
  };

  const selectOption = (opt: string) => {
    if (modalType === "employment") setEmployment(opt);
    if (modalType === "income") setIncome(opt);
    setModalType(null);
    setModalVisible(false);
  };

  /* ---------------------- Submit Application ---------------------- */
  const submitApplication = async () => {
    if (!fullName || !dob || !address || phone.length < 10) {
      Alert.alert("Incomplete Info", "Please complete all personal details.");
      return;
    }
    if (!employment || !income) {
      Alert.alert("Missing Details", "Please select employment & income.");
      return;
    }
    if (!purpose) {
      Alert.alert("Missing Purpose", "Please enter loan purpose.");
      return;
    }
    if (!idFile || !selfieFile || !proofFile) {
      Alert.alert("Missing Documents", "All supporting documents are required.");
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) {
        Alert.alert("Auth Error", "Not logged in.");
        setLoading(false);
        return;
      }

      /* ---------------------- Upload to Cloudinary ---------------------- */
      const idUrl = await uploadToCloudinary(idFile.uri, UPLOAD_PRESET, CLOUD_NAME);
      const selfieUrl = await uploadToCloudinary(selfieFile.uri, UPLOAD_PRESET, CLOUD_NAME);
      const proofUrl = await uploadToCloudinary(proofFile.uri, UPLOAD_PRESET, CLOUD_NAME);

      /* ---------------------- Payload ---------------------- */
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

        government_id_url: idUrl,
        selfie_with_id_url: selfieUrl,
        proof_of_funds_url: proofUrl,
      };

      const res = await fetch(`${API_BASE}/loans/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {}

      if (!res.ok) {
        Alert.alert("Error", data?.error || "Loan submission failed.");
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
    } catch (e) {
      console.log("Loan submission error:", e);
      Alert.alert("Error", "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------- Render Modal ---------------------- */
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

  /* ---------------------- Render Screen ---------------------- */
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
        {/* ------------------ Personal Info ------------------ */}
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

          <View style={styles.phoneInput}>
            <Text style={{ marginRight: 4, color: "#666" }}>+63</Text>
            <TextInput
              placeholder="9123456789"
              style={{ flex: 1 }}
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* ------------------ Employment ------------------ */}
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

        {/* ------------------ Loan Details ------------------ */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Loan Details</Text>

          <Text style={{ marginBottom: 6 }}>Desired Amount</Text>
          <Text style={styles.amountValue}>₱ {amount.toLocaleString()}</Text>

          <Slider
            value={amount}
            minimumValue={MIN_AMOUNT}
            maximumValue={MAX_AMOUNT}
            step={AMOUNT_STEP}
            onValueChange={(v: any) => {
              if (Array.isArray(v)) setAmount(Number(v[0]));
              else setAmount(Number(v));
            }}
          />

          <View style={styles.sliderLabels}>
            <Text>₱{MIN_AMOUNT}</Text>
            <Text>₱{MAX_AMOUNT}</Text>
          </View>

          {/* Duration */}
          <Text style={{ marginTop: 10 }}>Repayment Term</Text>

          <View style={styles.termRow}>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.termBtn,
                  duration === d ? styles.termBtnActive : styles.termBtnInactive,
                ]}
                onPress={() => setDuration(d)}
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
            style={[styles.input, { height: 80 }]}
            value={purpose}
            onChangeText={setPurpose}
            multiline
          />

          {/* ------------------ Payout ------------------ */}
          <Text style={{ marginTop: 10 }}>Disbursement Method</Text>

          <View style={styles.payoutRow}>
            {["gcash", "maya", "bank"].map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.payoutBtn,
                  payoutMethod === m ? styles.payoutBtnActive : null,
                ]}
                onPress={() => setPayoutMethod(m as any)}
              >
                <Text style={{ fontWeight: "700" }}>{m.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            placeholder="Account / Mobile Number"
            style={styles.input}
            value={payoutDetails.account}
            onChangeText={(t) =>
              setPayoutDetails({ ...payoutDetails, account: t })
            }
          />

          {payoutMethod === "bank" && (
            <TextInput
              placeholder="Bank Name"
              style={styles.input}
              value={payoutDetails.bank}
              onChangeText={(t) =>
                setPayoutDetails({ ...payoutDetails, bank: t })
              }
            />
          )}

          <TextInput
            placeholder="Beneficiary Name"
            style={styles.input}
            value={payoutDetails.name}
            onChangeText={(t) =>
              setPayoutDetails({ ...payoutDetails, name: t })
            }
          />

          {/* ------------------ Summary ------------------ */}
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Loan Summary</Text>
            <Text>Principal: ₱ {principal.toLocaleString()}</Text>
            <Text>Interest (20%): ₱ {interest.toLocaleString()}</Text>
            <Text>Total Payable: ₱ {totalPayable.toLocaleString()}</Text>
            <Text>Term: {duration} days</Text>
            <Text style={styles.dailyLabel}>
              Daily Payment: ₱ {dailyPayment.toFixed(2)}
            </Text>

            <Text style={styles.lateFeeNote}>
              ₱1,000 late fee applied after 2 consecutive missed days.
            </Text>
          </View>
        </View>

        {/* ------------------ Documents ------------------ */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Required Documents</Text>

          {/* Government ID */}
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => pickFile(setIdFile)}
          >
            <Text style={styles.uploadText}>
              {idFile ? "Change Government ID" : "Upload Government ID"}
            </Text>
          </TouchableOpacity>
          {idFile && <Image source={{ uri: idFile.uri }} style={styles.preview} />}

          {/* Selfie */}
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => pickFile(setSelfieFile)}
          >
            <Text style={styles.uploadText}>
              {selfieFile ? "Change Selfie (with ID)" : "Upload Selfie Holding ID"}
            </Text>
          </TouchableOpacity>
          {selfieFile && <Image source={{ uri: selfieFile.uri }} style={styles.preview} />}

          {/* Proof of Income */}
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => pickFile(setProofFile)}
          >
            <Text style={styles.uploadText}>
              {proofFile ? "Change Proof of Income" : "Upload Proof of Income"}
            </Text>
          </TouchableOpacity>
          {proofFile && <Image source={{ uri: proofFile.uri }} style={styles.preview} />}
        </View>

        {/* ------------------ Submit ------------------ */}
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
    borderBottomWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  cancel: { color: "#0077C8", fontWeight: "700" },
  title: { fontWeight: "700", fontSize: 16 },
  option: { padding: 16, backgroundColor: "#fff" },
  optionText: { fontSize: 16 },
});

/* ---------------- MAIN STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f6f7fb" },

  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },

  hamburger: { marginBottom: 10 },
  hamLine: { width: 22, height: 3, backgroundColor: "#fff", marginVertical: 2 },

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
  },

  phoneInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cfeefc",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },

  selectorInput: {
    borderWidth: 1,
    borderColor: "#cfeefc",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
  },

  amountValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0077C8",
    textAlign: "center",
    marginBottom: 6,
  },

  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  termRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  termBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 85,
    alignItems: "center",
  },
  termBtnActive: { backgroundColor: "#0077C8" },
  termBtnInactive: { backgroundColor: "#f3f8fb" },

  payoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  payoutBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f3f8fb",
    minWidth: 84,
    alignItems: "center",
  },
  payoutBtnActive: { borderColor: "#0077C8", borderWidth: 2 },

  summaryBox: {
    backgroundColor: "#f3faff",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  summaryTitle: { fontWeight: "700", marginBottom: 6 },
  dailyLabel: { fontWeight: "700", marginTop: 6 },
  lateFeeNote: { marginTop: 6, color: "#666", fontSize: 12 },

  uploadBtn: {
    backgroundColor: "#e0f3ff",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  uploadText: { color: "#0077C8", fontWeight: "600" },

  preview: {
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
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
