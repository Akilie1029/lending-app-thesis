// src/services/adminDashboardService.ts
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../config";

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem("userToken");
  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
}

async function load() {
  const headers = await getAuthHeaders();

  try {
    const res = await axios.get(`${API_BASE}/admin/dashboard`, { headers });

    const data = res.data || {};

    // Normalize each section (fallbacks prevent crashes)
    return {
      borrowerCount: data.borrowerCount ?? 0,
      activeLoanCount: data.activeLoanCount ?? 0,
      rejectedCount: data.rejectedCount ?? 0,
      pendingLoanApproval: data.pendingLoanApproval ?? 0,
      pendingDisbursement: data.pendingDisbursement ?? 0,

      loanStatusDistribution: {
        paidAmount: data.loanStatusDistribution?.paidAmount ?? 0,
        unpaidAmount: data.loanStatusDistribution?.unpaidAmount ?? 0,
        overdueAmount: data.loanStatusDistribution?.overdueAmount ?? 0,
      },

      // 4-week overview
      paymentOverview4: {
        labels: data.paymentOverview4?.labels ?? ["W1", "W2", "W3", "W4"],
        expected: data.paymentOverview4?.expected ?? [0, 0, 0, 0],
        actual: data.paymentOverview4?.actual ?? [0, 0, 0, 0],
      },

      weeklyCollections: {
        labels: data.weeklyCollections?.labels ?? [],
        values: data.weeklyCollections?.values ?? [],
      },

      paymentBehavior: {
        labels: data.paymentBehavior?.labels ?? ["On Time", "Late"],
        onTime: data.paymentBehavior?.onTime ?? [0],
        late: data.paymentBehavior?.late ?? [0],
      },

      cashflow: {
        labels: data.cashflow?.labels ?? [],
        repaid: data.cashflow?.repaid ?? [],
        disbursed: data.cashflow?.disbursed ?? [],
      },
    };
  } catch (err) {
    console.error("Dashboard load error:", err?.response?.data || err.message);
    throw err;
  }
}

export default { load };
