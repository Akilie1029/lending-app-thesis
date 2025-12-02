// src/screens/AdminLoanDetailsScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import api from "../services/api";

export default function AdminLoanDetailsScreen({ route, navigation }: any) {
  const { loanId } = route.params;

  const [loan, setLoan] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLoan();
  }, []);

  const loadLoan = async () => {
    try {
      setLoading(true);
      console.log("📡 Fetching loan details for loanId:", loanId);

      const res = await api.get(`/admin/loan/${loanId}/details`);
      console.log("📥 Loan Details Response:", res.data);

      setLoan(res.data.loan || {});
      setSchedule(res.data.schedule || []);
    } catch (err: any) {
      console.error("❌ Loan details load error:", err?.response?.data || err);
      Alert.alert("Error", "Unable to load loan details.");
    } finally {
      setLoading(false);
    }
  };

  const renderRow = (label: string, value: any) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{String(value ?? "-")}</Text>
    </View>
  );

  if (loading || !loan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#169AF9" />
        <Text style={{ marginTop: 10 }}>Loading loan details...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f3f6fa" }}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ paddingRight: 12 }}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loan Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* BORROWER CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Borrower Info</Text>

          {renderRow("Name", loan.full_name)}
          {renderRow("Email", loan.email)}
        </View>

        {/* LOAN INFO */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Loan Information</Text>

          {renderRow("Loan ID", loan.id)}
          {renderRow("Principal", `₱${Number(loan.principal).toLocaleString()}`)}
          {renderRow(
            "Daily Payment",
            `₱${Number(loan.daily_payment ?? 0).toLocaleString()}`
          )}
          {renderRow("Purpose", loan.purpose)}
          {renderRow("Days", loan.days)}
          {renderRow("Status", loan.status)}
          {renderRow(
            "Created",
            loan.created_at ? new Date(loan.created_at).toLocaleString() : "-"
          )}
        </View>

        {/* DOCUMENTS BUTTON */}
        <TouchableOpacity
          style={styles.documentsBtn}
          onPress={() =>
            navigation.navigate("AdminLoanDocumentsScreen", {
              loanId: loan.id,
            })
          }
        >
          <Icon name="document-text-outline" size={20} color="#fff" />
          <Text style={styles.documentsBtnText}>View Submitted Documents</Text>
        </TouchableOpacity>

        {/* REPAYMENT SCHEDULE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Repayment Schedule</Text>

          {schedule.length === 0 ? (
            <Text style={{ color: "#777", marginTop: 10 }}>
              No schedule available.
            </Text>
          ) : (
            schedule.map((item, index) => (
              <View key={index} style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>
                  Day {item.day_number ?? index + 1}
                </Text>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.scheduleAmount}>
                    ₱ {Number(item.expected_amount ?? 0).toLocaleString()}
                  </Text>
                  <Text
                    style={[
                      styles.scheduleStatus,
                      item.status === "paid" ? styles.green : styles.orange,
                    ]}
                  >
                    {item.status?.toUpperCase() ?? "PENDING"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#169AF9",
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
    color: "#111",
  },

  row: {
    marginBottom: 10,
  },
  rowLabel: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
  rowValue: {
    fontSize: 15,
    color: "#111",
    marginTop: 2,
    fontWeight: "700",
  },

  scheduleRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  scheduleLabel: { fontWeight: "700", fontSize: 14 },

  scheduleAmount: { fontWeight: "700", fontSize: 14 },

  scheduleStatus: { marginTop: 3, fontWeight: "700" },
  green: { color: "#19d06b" },
  orange: { color: "#d67f00" },

  documentsBtn: {
    backgroundColor: "#0077C8",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  documentsBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});
