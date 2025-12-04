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
import { API_BASE } from "../config";
import { useIsFocused } from "@react-navigation/native";

const LOG_PREFIX = "[MY_LOANS]";

const FILTERS = ["All", "Pending", "Active", "Paid"] as const;
type Filter = (typeof FILTERS)[number];

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MyLoanScreen({ navigation }: any) {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<Filter>("All");
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) fetchLoans();
  }, [isFocused]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("userToken");

      if (!token) {
        setLoans([]);
        setLoading(false);
        return;
      }

      console.log(LOG_PREFIX, "📡 Fetching borrower loans...");
      const res = await axios.get(`${API_BASE}/loans/my-loans`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // backend returns array in most implementations we've seen
      const payload = Array.isArray(res.data) ? res.data : res.data?.loans ?? [];
      console.log(LOG_PREFIX, "📥 Borrower Loans count:", payload.length);

      setLoans(payload);
    } catch (err) {
      console.error(LOG_PREFIX, "❌ Loan fetch error:", err?.response?.data || err.message);
      Alert.alert("Error", "Unable to fetch loans. Please try again.");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // -----------------------------
  // UPDATED FILTERING FOR NEW STATUSES
  // -----------------------------
  const filteredLoans = loans.filter((l) => {
    const st = (l.status || "").toLowerCase();

    // helper boolean checks
    const isApprovedPending = st === "approved_pending_disburse"; // admin approved — borrower must accept/reject
    const isApprovedAndWaitingDisbursement = st === "approved" && !l.disbursed_at; // borrower already accepted (or legacy), waiting for disburse
    const isActive = st === "active";
    const isPaid = st === "paid" || st === "completed";

    if (filter === "All") return true;

    if (filter === "Pending") {
      // Pending includes:
      // - original pending applications
      // - admin-approved but awaiting borrower decision (approved_pending_disburse)
      // - loans approved but not disbursed yet (approved && !disbursed_at)
      return (
        st === "pending" ||
        isApprovedPending ||
        isApprovedAndWaitingDisbursement
      );
    }

    if (filter === "Active") {
      // active loans / disbursed loans
      return isActive || (st === "approved" && l.disbursed_at);
    }

    if (filter === "Paid") {
      return isPaid;
    }

    return true;
  });

  // -----------------------------
  // STATUS ICON LOGIC UPDATED
  // -----------------------------
  const getStatusIcon = (status?: string) => {
    const s = (status || "").toLowerCase();

    if (s === "approved_pending_disburse")
      return <Icon name="alert-circle" size={22} color="#d67f00" />; // needs borrower action

    if (s === "approved")
      return <Icon name="checkmark-circle" size={22} color="#00B050" />;

    if (s === "active")
      return <Icon name="checkmark-circle" size={22} color="#00B050" />;

    if (s === "pending")
      return <Icon name="time" size={22} color="#169AF9" />;

    if (s === "paid" || s === "completed")
      return <Icon name="checkmark-done-circle" size={22} color="#0077C8" />;

    return <MCIcon name="file-document" size={22} color="#169AF9" />;
  };

  const computeProgress = (loan: any) => {
    const total = Number(loan.total_payable ?? 0);
    const remaining = Number(loan.remaining_balance ?? 0);
    if (!total || total <= 0) return 0;
    const paid = Math.max(0, total - remaining);
    return Math.min(1, Math.max(0, paid / total));
  };

  // -----------------------------
  // Helpers: get display principal (use approved_principal when present)
  // -----------------------------
  function getDisplayPrincipal(loan: any) {
    // We attempt multiple likely field names for approved principal (covers backend variations)
    const approvedCandidates = [
      loan.approved_principal,
      loan.approved_amount,
      loan.approved_principal_amount,
      loan.approved,
      loan.approved_principal_value,
    ];

    for (const v of approvedCandidates) {
      if (v !== null && v !== undefined) {
        const n = Number(v);
        if (!Number.isNaN(n) && n > 0) {
          return n;
        }
      }
    }

    // fallback to standard principal / amount fields
    const fallback = Number(loan.principal ?? loan.amount ?? loan.amount_requested ?? 0);
    return Number.isNaN(fallback) ? 0 : fallback;
  }

  // -----------------------------
  // RENDER A LOAN CARD
  // -----------------------------
  const renderLoan = ({ item }: { item: any }) => {
    const id = String(item.id);
    const isExpanded = !!expandedMap[id];
    const status = (item.status || "").toLowerCase();

    const isApprovedPending = status === "approved_pending_disburse";
    const isApprovedAndWaitingDisbursement = status === "approved" && !item.disbursed_at;
    const isPending = status === "pending" || isApprovedPending || isApprovedAndWaitingDisbursement;

    // NEW: always prefer approved principal if available (per your spec)
    const principal = getDisplayPrincipal(item);

    const total = Number(item.total_payable ?? 0);
    const daily = Number(item.daily_payment ?? 0);
    const remaining = Number(item.remaining_balance ?? 0);

    const progress = computeProgress(item);
    const progressPct = Math.round(progress * 100);

    // -----------------------------
    // STATUS LABEL FIXES
    // -----------------------------
    let statusLabel = (status || "").toUpperCase();

    if (isApprovedPending) statusLabel = "AWAITING YOUR APPROVAL";
    else if (isApprovedAndWaitingDisbursement) statusLabel = "PENDING DISBURSEMENT";
    else if (status === "pending") statusLabel = "APPLICATION PENDING";
    else if (status === "active") statusLabel = "ACTIVE";
    else if (status === "paid" || status === "completed") statusLabel = "PAID / COMPLETED";

    return (
      <View style={styles.loanCard}>
        {/* HEADER ROW */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => toggleExpand(id)}
          style={styles.cardHeaderRow}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {getStatusIcon(item.status)}
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.loanTitle}>₱ {principal.toLocaleString()}</Text>
              <Text style={styles.loanSubtitle}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={[
                styles.statusText,
                isPending && { color: "#169AF9" },
                isApprovedPending && { color: "#d67f00" },
              ]}
            >
              {statusLabel}
            </Text>
            <Icon
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={22}
              color="#333"
            />
          </View>
        </TouchableOpacity>

        {/* EXPANDED AREA */}
        {isExpanded && (
          <View style={styles.cardBody}>
            {/* DEFAULT PENDING APPLICATION */}
            {status === "pending" && (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Text style={{ color: "#666", fontSize: 14, textAlign: "center" }}>
                  Your loan application is still under review.
                </Text>
              </View>
            )}

            {/* APPROVED PENDING BORROWER ACCEPTANCE */}
            {isApprovedPending && (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Text style={{ color: "#d67f00", fontSize: 14, textAlign: "center" }}>
                  Your loan has been approved by admin. Please review and accept or reject in Details.
                </Text>
              </View>
            )}

            {/* APPROVED BUT NOT YET DISBURSED (borrower already accepted) */}
            {isApprovedAndWaitingDisbursement && (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Text style={{ color: "#666", fontSize: 14, textAlign: "center" }}>
                  You've accepted the approved amount — waiting for admin to disburse.
                </Text>
              </View>
            )}

            {/* ACTIVE / DISBURSED LOAN DETAILS */}
            {(status === "active" || (status === "approved" && item.disbursed_at)) && (
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

            {/* FOOTER ROW */}
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.detailsBtn}
                onPress={() => navigation.navigate("Loan Details", { loan: item })}
              >
                <Text style={styles.detailsBtnText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f6f7fb" }}>
      {/* HEADER */}
      <LinearGradient colors={["#169AF9", "#37AAF2"]} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Loans</Text>
        <View style={{ width: 44 }} />
      </LinearGradient>

      {/* FILTER ROW */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFilter(f);
            }}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
          >
            <Text style={filter === f ? styles.filterTextActive : styles.filterText}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* BODY */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#169AF9" />
        </View>
      ) : (
        <FlatList
          data={filteredLoans}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderLoan}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                {loans.length === 0
                  ? "You have no loan history."
                  : "No loans for this filter."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

/* ---------------------------- STYLES ---------------------------- */

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

  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  loanTitle: { fontSize: 18, fontWeight: "800" },
  loanSubtitle: { fontSize: 12, color: "#666" },
  statusText: { fontSize: 12, fontWeight: "700", color: "#555", marginBottom: 4 },

  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: "#fbfeff",
  },

  row: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  smallLabel: { width: 110, fontSize: 13, color: "#666" },
  smallValue: { fontSize: 14, fontWeight: "700", color: "#000" },

  progressTrack: { height: 8, backgroundColor: "#e6f2fb", borderRadius: 8 },
  progressFill: { height: 8, backgroundColor: "#169AF9" },
  progressPct: { fontSize: 12, color: "#666", marginTop: 6 },

  payNowBtn: {
    marginTop: 10,
    backgroundColor: "#169AF9",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  payNowText: { color: "#fff", fontWeight: "800" },

  footerRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  detailsBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#169AF9",
  },
  detailsBtnText: { color: "#169AF9", fontWeight: "700" },

  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyBox: { marginTop: 60, alignItems: "center" },
  emptyText: { fontSize: 15, color: "#666" },
});
