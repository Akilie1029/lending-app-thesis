// src/services/adminDashboardService.ts
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { mapDashboard } from "../mappers/adminDashboardMapper";

/* ------------------------------
 * Types
 * ------------------------------ */

export type DashboardResponse = {
  borrowerCount: number;
  activeLoanCount: number;
  rejectedCount: number;
  pendingLoanApproval: number;
  pendingDisbursement: number;
  totalDisbursedLoan: number;

  loanStatusDistribution: {
    unpaidAmount: number;
    paidAmount: number;
    overdueAmount: number;
  };

  paymentOverview: {
    collectiblesToday: number;
    actualPayments: number;
  };

  weeklyCollections: number[];

  weeklyPayments4: number[];
  weeklyCollectibles4: number[];

  onTimeCounts4: number[];
  lateCounts4: number[];

  weeklyRepayments12: number[];
  weeklyDisbursements12: number[];
  weeklyNet12: number[];
};

export type DashboardUI = {
  borrowerCount: number;
  activeLoanCount: number;
  rejectedCount: number;
  pendingLoanApproval: number;
  pendingDisbursement: number;
  totalDisbursedLoan: number;

  loanStatusDistribution: {
    unpaidAmount: number;
    paidAmount: number;
    overdueAmount: number;
  };

  paymentOverview: {
    collectiblesToday: number;
    actualPayments: number;
  };

  weeklyCollections: {
    labels: string[];
    values: number[];
  };

  paymentOverview4: {
    labels: string[];
    expected: number[];
    actual: number[];
  };

  paymentBehavior: {
    labels: string[];
    onTime: number[];
    late: number[];
  };

  cashflow: {
    labels: string[];
    disbursed: number[];
    repaid: number[];
    net: number[];
  };
};

/* ------------------------------
 * Service
 * ------------------------------ */
const adminDashboardService = {
  async load(): Promise<DashboardUI> {
    const token = await AsyncStorage.getItem("userToken");
    if (!token) throw new Error("No auth token found.");

    const res = await axios.get<DashboardResponse>(
      "http://192.168.1.222:5001/api/admin/dashboard-stats",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const raw = res.data;

    // map & normalize for UI safety
    return mapDashboard(raw);
  },
};

export default adminDashboardService;
