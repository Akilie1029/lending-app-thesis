// src/screens/AdminLoanDocumentsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Dimensions,
  Alert,
} from "react-native";
import { useFocusEffect, useRoute, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";
import api from "../services/api";

const { width: SCREEN_W } = Dimensions.get("window");

type Doc = {
  id: number | string;
  loan_id: number | string;
  doc_type: string;
  url: string;
  uploaded_at?: string;
};

export default function AdminLoanDocumentsScreen() {
  const route: any = useRoute();
  const navigation: any = useNavigation();

  const loanId = route.params?.loanId;
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Doc | null>(null);

  const loadDocs = useCallback(async () => {
    if (!loanId) {
      Alert.alert("Error", "Missing loan ID.");
      return;
    }

    try {
      setLoading(true);

      console.log("📡 Fetching documents for loanId:", loanId);

      const res = await api.get(`/admin/loan/${loanId}/documents`);
      console.log("📥 Documents Response:", res.data);

      const loan = res.data?.loan || {};
      const list: Doc[] = [];

      if (loan.gov_id_uri) {
        list.push({
          id: "gov_id",
          loan_id: loanId,
          doc_type: "Government ID",
          url: loan.gov_id_uri,
        });
      }
      if (loan.selfie_id_uri) {
        list.push({
          id: "selfie_id",
          loan_id: loanId,
          doc_type: "Selfie with ID",
          url: loan.selfie_id_uri,
        });
      }
      if (loan.proof_uri) {
        list.push({
          id: "proof_income",
          loan_id: loanId,
          doc_type: "Proof of Income",
          url: loan.proof_uri,
        });
      }

      setDocs(list);
    } catch (err) {
      console.error("❌ Load loan documents error:", err?.response?.data || err);
      Alert.alert("Error", "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useFocusEffect(
    useCallback(() => {
      loadDocs();
    }, [loadDocs])
  );

  const handleGoBack = () => {
    console.log("🔙 Going back to AdminLoanReviewScreen…");

    navigation.navigate("AdminLoanReviewScreen", { loanId });
  };

  const renderItem = ({ item }: { item: Doc }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)}>
      <Image source={{ uri: item.url }} style={styles.thumbnail} resizeMode="cover" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.title}>{item.doc_type}</Text>
        <Text style={styles.metaSmall}>
          {item.uploaded_at ? new Date(item.uploaded_at).toLocaleString() : ""}
        </Text>
      </View>
      <Icon name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack}>
          <Icon name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Documents</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#169AF9" />
        </View>
      ) : (
        <FlatList
          data={docs}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
          ListEmptyComponent={() => (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text>No documents found for this loan.</Text>
            </View>
          )}
        />
      )}

      {/* Fullscreen Preview */}
      <Modal visible={!!selected} transparent animationType="slide">
        <SafeAreaView style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 8 }}>
              <Icon name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>{selected?.doc_type || ""}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.previewBody}>
            {selected ? (
              <Image source={{ uri: selected.url }} style={styles.previewImage} resizeMode="contain" />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f6fa" },
  header: {
    backgroundColor: "#169AF9",
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#eef2f6",
  },

  thumbnail: {
    width: 84,
    height: 84,
    borderRadius: 8,
    backgroundColor: "#eef3f8",
  },
  title: { fontWeight: "800", fontSize: 15, color: "#111" },
  metaSmall: { color: "#999", fontSize: 12, marginTop: 6 },

  previewContainer: { flex: 1, backgroundColor: "#000" },
  previewHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    justifyContent: "space-between",
  },
  previewTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  previewBody: { flex: 1, justifyContent: "center", alignItems: "center" },
  previewImage: { width: SCREEN_W, height: "80%" },
});
