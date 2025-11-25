// src/screens/MyLoanScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
  FlatList,
  Alert,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/Ionicons";
import MCIcon from "react-native-vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import RNFS from "react-native-fs";
import FileViewer from "react-native-file-viewer";

const API_BASE = "http://192.168.1.222:5001/api";

/* =============================
    FILTER CONFIG
============================= */
const FILTERS = ["All", "Pending", "Active", "Paid"] as const;
type Filter = (typeof FILTERS)[number];

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MyLoanScreen({ navigation }: any) {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Filter>("All");

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");
      const res = await axios.get(`${API_BASE}/loans/my-loans`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setLoans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Loan fetch error:", err);
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /* =============================
      PDF DOWNLOAD HANDLER
  ============================= */
  const handleDownloadPDF = async (loan: any) => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      const url = `${API_BASE}/loans/${loan.id}/summary-pdf`;

      const path = `${RNFS.DownloadDirectoryPath}/loan-summary-${loan.id}.pdf`;

      const result = await RNFS.downloadFile({
        fromUrl: url,
        toFile: path,
        headers: { Authorization: `Bearer ${token}` },
      }).promise;

      if (result.statusCode !== 200) {
        throw new Error("Invalid status code: " + result.statusCode);
      }

      await FileViewer.open(path, {
        showOpenWithDialog: true,
        type: "application/pdf",
      });
    } catch (err) {
      Alert.alert("Error", "Unable to open PDF.");
      console.log("PDF Error:", err);
    }
  };

  /* =============================
      FILTER LOGIC
  ============================= */
  const filteredLoans = loans.filter((l) => {
    const st = (l.status || "").toLowerCase();

    if (filter === "All") return true;
    if (filter === "Pending") return st === "pending";
    if (filter === "Active") return st === "active" || st === "approved";
    if (filter === "Paid") return st === "paid" || st === "completed";

    return true;
  });

  /* =============================
      ICON HELPERS
  ============================= */
  const getStatusIcon = (status?: string) => {
    const s = (status || "").toLowerCase();
    if (s === "active" || s === "approved")
      return <Icon name="checkmark-circle" size={22} color="#00B050" />;
    if (s === "pending") return <Icon name="time" size={22} color="#F39C12" />;
    if (s === "paid" || s === "completed")
      return <Icon name="checkmark-done-circle" size={22} color="#0077C8" />;
    return <MCIcon name="file-document" size={22} color="#169AF9" />;
  };

  const computeProgress = (loan: any) => {
    const total = Number(loan.total_payable ?? 0);
    const remaining = Number(loan.remaining_balance ?? 0);
    if (!total || total <= 0) return 0;
    const paid = total - remaining;
    return Math.min(1, Math.max(0, paid / total));
  };

  /* =============================
      RENDER LOAN CARD
  ============================= */
  const renderLoan = ({ item }: { item: any }) => {
    const id = item.id;
    const isExpanded = !!expandedMap[id];

    const principal = Number(item.principal ?? item.amount_requested ?? 0);
    const total = Number(item.total_payable ?? 0);
    const daily = Number(item.daily_payment ?? 0);
    const remaining = Number(item.remaining_balance ?? 0);

    const progress = computeProgress(item);
    const progressPct = Math.round(progress * 100);

    return (
      <View style={styles.loanCard}>
        {/* HEADER */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => toggleExpand(id)}
          style={styles.cardHeader}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {getStatusIcon(item.status)}
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.loanTitle}>₱ {principal.toLocaleString()}</Text>
              <Text style={styles.loanSubtitle}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.statusText}>{String(item.status).toUpperCase()}</Text>
            <Icon name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color="#333" />
          </View>
        </TouchableOpacity>

        {/* BODY */}
        {isExpanded && (
          <View style={styles.cardBody}>
            {/* Pending → No repayment info */}
            {(item.status === "pending") && (
              <View style={{ paddingVertical: 10 }}>
                <Text style={{ color: "#666", fontSize: 14 }}>
                  Your loan application is still under review.
                </Text>
              </View>
            )}

            {/* Active */}
            {(item.status === "active" || item.status === "approved") && (
              <>
                <View style={styles.row}>
                  <Text style={styles.smallLabel}>Progress</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                    </View>
                    <Text style={styles.progressPct}>{progressPct}% paid</Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <Text style={styles.smallLabel}>Daily Payment</Text>
                  <Text style={styles.smallValue}>₱ {daily.toLocaleString()}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.smallLabel}>Total Payable</Text>
                  <Text style={styles.smallValue}>₱ {total.toLocaleString()}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.smallLabel}>Remaining</Text>
                  <Text style={[styles.smallValue, { color: "#D62828" }]}>
                    ₱ {remaining.toLocaleString()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.payNowBtn}
                  onPress={() => navigation.navigate("RepayLoan", { loan: item })}
                >
                  <Text style={styles.payNowText}>Make a Payment</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Footer Buttons */}
            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={styles.detailsBtn}
                onPress={() => navigation.navigate("Loan Details", { loan: item })}
              >
                <Text style={styles.detailsBtnText}>View Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => handleDownloadPDF(item)}
              >
                <Icon name="download-outline" size={22} color="#0077C8" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  /* =============================
      MAIN SCREEN
  ============================= */

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Loans</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      {/* FILTERS */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFilter(f);
            }}
            style={[
              styles.filterBtn,
              filter === f ? styles.filterBtnActive : undefined,
            ]}
          >
            <Text style={filter === f ? styles.filterTextActive : styles.filterText}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* LIST */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#169AF9" />
        </View>
      ) : (
        <FlatList
          data={filteredLoans}
          keyExtractor={(it) => it.id}
          renderItem={renderLoan}
          contentContainerStyle={{ paddingVertical: 12 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {loans.length === 0 ? "You have no loan history." : "No loans for this filter."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

/* =============================
      STYLES
============================= */
const styles = StyleSheet.create({
  header: {
    paddingTop: 50,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: { width: 44 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },

  filterRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6eef9",
  },
  filterBtnActive: {
    backgroundColor: "#169AF9",
    borderColor: "#169AF9",
  },
  filterText: { color: "#333", fontWeight: "600" },
  filterTextActive: { color: "#fff", fontWeight: "700" },

  loanCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e8f4ff",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  loanTitle: { fontSize: 18, fontWeight: "800" },
  loanSubtitle: { fontSize: 12, color: "#666" },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#555",
    marginBottom: 4,
  },

  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: "#fbfeff",
  },
  row: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  smallLabel: { width: 110, fontSize: 13, color: "#666" },
  smallValue: { fontSize: 14, fontWeight: "700", color: "#000" },

  progressTrack: {
    height: 8,
    backgroundColor: "#e6f2fb",
    borderRadius: 8,
  },
  progressFill: {
    height: 8,
    backgroundColor: "#169AF9",
  },
  progressPct: { fontSize: 12, color: "#666", marginTop: 6 },

  payNowBtn: {
    marginTop: 10,
    backgroundColor: "#169AF9",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  payNowText: { color: "#fff", fontWeight: "800" },

  cardFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  detailsBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#169AF9",
  },
  detailsBtnText: { color: "#169AF9", fontWeight: "700" },

  downloadBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#0077C8",
    backgroundColor: "#fff",
  },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  emptyBox: { marginTop: 60, alignItems: "center" },
  emptyText: { fontSize: 15, color: "#666" },
});
