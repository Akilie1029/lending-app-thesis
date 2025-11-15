import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PieChart } from "react-native-chart-kit";
import { useNavigation } from "@react-navigation/native";


const { width } = Dimensions.get("window");

type DashboardResponse = {
  borrowerCount: number;
  activeLoanCount: number;
  rejectedCount: number;
  loanStatusDistribution: { unpaidAmount: number; paidAmount: number; overdueAmount: number };
  paymentOverview: { collectiblesToday: number; actualPayments: number };
  pendingLoanApproval: number;
  pendingDisbursement: number;
  totalDisbursedLoan: number;
};

const AdminDashboardScreen = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
 const navigation = useNavigation<any>();
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setStats(null);

      const token = await AsyncStorage.getItem("userToken");
      console.log("🔑 Loaded token:", token);

      if (!token) {
        setErrorMsg("No auth token found. Please login again.");
        setLoading(false);
        return;
      }

      const res = await axios.get(
        "http://192.168.1.222:5001/api/admin/dashboard-stats",
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        }
      );

      console.log("✅ Dashboard response status:", res.status);
      console.log("📦 Dashboard response data:", res.data);

      // Basic validation
      if (!res.data || typeof res.data.borrowerCount === "undefined") {
        setErrorMsg("Unexpected response shape from server.");
        setLoading(false);
        return;
      }

      setStats(res.data);
      setLoading(false);
    } catch (err: any) {
      // Better error reporting
      console.error("Admin dashboard error (full):", err);

      // Network / axios error details
      if (err.response) {
        // server returned a response (4xx/5xx)
        console.error("Response data:", err.response.data);
        console.error("Response status:", err.response.status);
        setErrorMsg(`Server error: ${err.response.data?.msg || err.response.data || err.response.status}`);
      } else if (err.request) {
        // request was made but no response
        console.error("No response received. Request:", err.request);
        setErrorMsg("No response from backend. Check network or backend server.");
      } else {
        // other error
        setErrorMsg(err.message || "Unknown error");
      }

      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading dashboard...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "#c00", fontWeight: "700", marginBottom: 8 }}>Error</Text>
        <Text style={{ textAlign: "center", marginHorizontal: 20 }}>{errorMsg}</Text>

        <TouchableOpacity style={styles.retryButton} onPress={loadStats}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>

        <Text style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
          Check Metro logs for full error details.
        </Text>
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.center}>
        <Text>No dashboard data available.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadStats}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const loanPieData = [
    { name: "Unpaid", amount: stats.loanStatusDistribution.unpaidAmount, color: "#1E90FF", legendFontColor: "#333", legendFontSize: 12 },
    { name: "Paid", amount: stats.loanStatusDistribution.paidAmount, color: "#00C853", legendFontColor: "#333", legendFontSize: 12 },
    { name: "Overdue", amount: stats.loanStatusDistribution.overdueAmount, color: "#FF3B30", legendFontColor: "#333", legendFontSize: 12 },
  ];

  const paymentPieData = [
    { name: "Collectibles", amount: stats.paymentOverview.collectiblesToday, color: "#1E90FF", legendFontColor: "#333", legendFontSize: 12 },
    { name: "Payments", amount: stats.paymentOverview.actualPayments, color: "#00C853", legendFontColor: "#333", legendFontSize: 12 },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}><Text style={styles.headerTitle}>Admin Dashboard</Text></View>

      {/* Top counters */}
      <View style={styles.row}>
        <View style={styles.topCard}><Text style={styles.topNumber}>{stats.borrowerCount}</Text><Text style={styles.topLabel}>Borrowers</Text></View>
        <View style={styles.topCard}><Text style={styles.topNumber}>{stats.activeLoanCount}</Text><Text style={styles.topLabel}>Active Loans</Text></View>
        <View style={[styles.topCard, styles.rejectedCard]}><Text style={[styles.topNumber, { color: "#fff" }]}>{stats.rejectedCount}</Text><Text style={[styles.topLabel, { color: "#fff" }]}>Rejected</Text></View>
      </View>

      {/* Loan distribution */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Loan Status Distribution</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.legend}>🟦 Unpaid — ₱ {stats.loanStatusDistribution.unpaidAmount.toLocaleString()}</Text>
            <Text style={styles.legend}>🟩 Paid — ₱ {stats.loanStatusDistribution.paidAmount.toLocaleString()}</Text>
            <Text style={styles.legend}>🟥 Overdue — ₱ {stats.loanStatusDistribution.overdueAmount.toLocaleString()}</Text>
          </View>

          <PieChart data={loanPieData} width={140} height={140} accessor="amount" backgroundColor="transparent" paddingLeft="0" center={[0, 0]} absolute chartConfig={{ color: (o) => `rgba(0,0,0,${o})` }} />
        </View>
      </View>

      {/* Payment overview */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Overview</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.legend}>Collectibles Today — ₱ {stats.paymentOverview.collectiblesToday.toLocaleString()}</Text>
            <Text style={styles.legend}>Actual Payments — ₱ {stats.paymentOverview.actualPayments.toLocaleString()}</Text>
          </View>
          <PieChart data={paymentPieData} width={140} height={140} accessor="amount" backgroundColor="transparent" paddingLeft="0" center={[0, 0]} absolute chartConfig={{ color: (o) => `rgba(0,0,0,${o})` }} />
        </View>

{/* Pending actions */}
<View style={{ marginTop: 10 }}>
  
  {/* Navigate to Loan Approvals */}
  <TouchableOpacity
    style={styles.badgeButton}
    onPress={() => navigation.navigate("AdminLoanApprovalScreen")}
  >
    <Text style={styles.badgeText}>Pending Loan Approval</Text>
    <View style={styles.badgeCount}>
      <Text style={styles.badgeCountText}>
        {stats.pendingLoanApproval}
      </Text>
    </View>
  </TouchableOpacity>

  {/* Navigate to Disbursement */}
  <TouchableOpacity
    style={[styles.badgeButton, { backgroundColor: "#ff3b30" }]}
    onPress={() => navigation.navigate("AdminDisbursementScreen")}
  >
    <Text style={[styles.badgeText, { color: "#fff" }]}>
      Pending Disbursement
    </Text>
    <View style={[styles.badgeCount, { backgroundColor: "#fff" }]}>
      <Text style={styles.badgeCountTextRed}>
        {stats.pendingDisbursement}
      </Text>
    </View>
  </TouchableOpacity>

</View>

    </ScrollView>
  );
};

export default AdminDashboardScreen;

const styles = StyleSheet.create({
  container: { backgroundColor: "#f3f6fa", padding: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#00a6ff", padding: 16, borderRadius: 10, marginBottom: 12 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topCard: { flex: 1, backgroundColor: "#e6f5ff", paddingVertical: 12, alignItems: "center", marginHorizontal: 4, borderRadius: 12 },
  rejectedCard: { backgroundColor: "#ff3b30" },
  topNumber: { fontSize: 22, fontWeight: "800", color: "#0071b2" },
  topLabel: { fontSize: 12, color: "#333" },
  panel: { backgroundColor: "#fff", padding: 14, borderRadius: 12, marginTop: 12 },
  panelTitle: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  legend: { fontSize: 13, marginVertical: 2 },
  badgeButton: { backgroundColor: "#FFC107", padding: 10, borderRadius: 10, marginTop: 10, flexDirection: "row", justifyContent: "space-between" },
  badgeText: { fontSize: 14, fontWeight: "700" },
  badgeCount: { backgroundColor: "#ff3b30", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeCountText: { color: "#fff", fontWeight: "800" },
  badgeCountTextRed: { color: "#ff3b30", fontWeight: "800" },
  totalCard: { backgroundColor: "#00a6ff", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 16 },
  totalAmount: { color: "#fff", fontSize: 20, fontWeight: "900" },
  totalLabel: { color: "#fff", opacity: 0.9 },
  retryButton: { marginTop: 12, backgroundColor: "#0A9EFA", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "700" },
});
