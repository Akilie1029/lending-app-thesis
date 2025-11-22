// src/mappers/adminDashboardMapper.ts
import { DashboardResponse, DashboardUI } from "../services/adminDashboardService";

export function mapDashboard(raw: DashboardResponse): DashboardUI {
  /* ------------------------------
   * Safe helper: array fallback
   * ------------------------------ */
  const arr = (a: any, len: number) =>
    Array.isArray(a) && a.length === len ? a : Array(len).fill(0);

  /* ------------------------------
   * Weekly Collections (7 days)
   * ------------------------------ */
  const weeklyCollections = {
    labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    values: arr(raw.weeklyCollections, 7),
  };

  /* ------------------------------
   * Payment Overview (4 weeks)
   * ------------------------------ */
  const paymentOverview4 = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    expected: arr(raw.weeklyCollectibles4, 4),
    actual: arr(raw.weeklyPayments4, 4),
  };

  /* ------------------------------
   * Payment Behavior (4 weeks)
   * ------------------------------ */
  const paymentBehavior = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    onTime: arr(raw.onTimeCounts4, 4),
    late: arr(raw.lateCounts4, 4),
  };

  /* ------------------------------
   * Cashflow Overview (12 weeks)
   * ------------------------------ */
  const cashflowLabels = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);

  const cashflow = {
    labels: cashflowLabels,
    disbursed: arr(raw.weeklyDisbursements12, 12),
    repaid: arr(raw.weeklyRepayments12, 12),
    net: arr(raw.weeklyNet12, 12),
  };

  /* ------------------------------
   * Final mapped UI object
   * ------------------------------ */
  return {
    borrowerCount: raw.borrowerCount ?? 0,
    activeLoanCount: raw.activeLoanCount ?? 0,
    rejectedCount: raw.rejectedCount ?? 0,
    pendingLoanApproval: raw.pendingLoanApproval ?? 0,
    pendingDisbursement: raw.pendingDisbursement ?? 0,
    totalDisbursedLoan: raw.totalDisbursedLoan ?? 0,

    loanStatusDistribution: {
      unpaidAmount: raw.loanStatusDistribution?.unpaidAmount ?? 0,
      paidAmount: raw.loanStatusDistribution?.paidAmount ?? 0,
      overdueAmount: raw.loanStatusDistribution?.overdueAmount ?? 0,
    },

    paymentOverview: {
      collectiblesToday: raw.paymentOverview?.collectiblesToday ?? 0,
      actualPayments: raw.paymentOverview?.actualPayments ?? 0,
    },

    weeklyCollections,
    paymentOverview4,
    paymentBehavior,
    cashflow,
  };
}
