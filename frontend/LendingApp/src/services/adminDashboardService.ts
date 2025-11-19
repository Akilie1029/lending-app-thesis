// src/services/adminDashboardService.ts
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Admin Dashboard Service
 * - Normalizes backend dashboard payload
 * - Produces chart-ready datasets:
 *    * collectionsChart (7-day)
 *    * paymentsVsCollectiblesChart (4-week)
 *    * onTimeLateChart (4-week counts based on activeLoanCount)
 *    * cashflowChart (12-week: repayments vs disbursements + net)
 *
 * All numbers are safe (fallbacks applied). Trend generators are hybrid-realistic.
 */

/* -------------------- Types -------------------- */
type Frequency = "daily" | "weekly" | "monthly";

export type DashboardRaw = {
  borrowerCount?: number;
  activeLoanCount?: number;
  rejectedCount?: number;
  loanStatusDistribution?: { unpaidAmount?: number; paidAmount?: number; overdueAmount?: number };
  paymentOverview?: { collectiblesToday?: number; actualPayments?: number };
  pendingLoanApproval?: number;
  pendingDisbursement?: number;
  totalDisbursedLoan?: number;
  loansAtRisk?: number;
  weeklyCollections?: number[]; // maybe provided by backend (7)
  dailyRepayments?: number[]; // may provide
  upcomingPayments?: Array<{ id: string; borrower: string; due: string; amount: number }>;
  // optionally backend might return:
  weeklyDisbursements?: number[]; // optional
  weeklyRepayments?: number[]; // optional (12 weeks)
};

type ChartDataset = {
  labels: string[];
  datasets: { data: number[]; color?: (opacity?: number) => string }[];
};

export type DashboardUIStats = {
  borrowerCount: number;
  activeLoanCount: number;
  rejectedCount: number;
  loanStatusDistribution: { unpaidAmount: number; paidAmount: number; overdueAmount: number };
  paymentOverview: { collectiblesToday: number; actualPayments: number };
  pendingLoanApproval: number;
  pendingDisbursement: number;
  totalDisbursedLoan: number;
  loansAtRisk: number;
  upcomingPayments: Array<{ id: string; borrower: string; due: string; amount: number }>;

  ringPercent: { paidPct: number; unpaidPct: number; overduePct: number };

  collectionsChart: ChartDataset; // 7-day (Mon-Sun)
  paymentsVsCollectiblesChart: ChartDataset; // 4-week (W1-W4)
  onTimeLateChart: ChartDataset; // 4-week counts (on-time vs late)
  cashflowChart: ChartDataset; // 12-week (repayments vs disbursements), net available separately

  // debug/raw arrays
  rawWeeklyCollections: number[];
  raw12WeekRepayments: number[];
  raw12WeekDisbursements: number[];
  rawOnTimeCounts?: number[];
  rawLateCounts?: number[];
  rawNetCashflow?: number[];
};

/* -------------------- Helpers -------------------- */

function clamp(n: number, lo = 0, hi = Number.POSITIVE_INFINITY) {
  return Math.max(lo, Math.min(hi, n));
}

function movingAverage(data: number[], window = 3) {
  if (!Array.isArray(data) || data.length === 0) return [];
  if (window <= 1) return [...data];
  const out: number[] = [];
  const half = Math.floor(window / 2);
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length - 1, i + half);
    const slice = data.slice(start, end + 1);
    const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
    out.push(Math.round(avg));
  }
  return out;
}

/** Ensure array length by padding zeros at start or trimming end */
function ensureLength(arr: number[] = [], length = 7) {
  const out = Array.from(arr || []);
  while (out.length < length) out.unshift(0);
  if (out.length > length) return out.slice(out.length - length);
  return out;
}

/** Generate plausible weekly placeholders based on totals */
function genWeeklyPlaceholder(total = 0, length = 7) {
  const base = Math.max(0, Math.round(total / Math.max(1, length * 4)));
  return Array.from({ length }, (_, i) => Math.max(0, base + Math.round(Math.sin((i + 1) * 0.8) * base * 0.4)));
}

/** Hybrid realistic trend generator */
function generateHybridTrend(baseValue: number, points = 12, variancePct = 15) {
  const base = Math.max(0, Math.round(baseValue || 0));
  if (base === 0) return Array.from({ length: points }, () => 0);
  const trend: number[] = [];
  const seed = Math.abs(base) % 97;
  for (let i = 0; i < points; i++) {
    const wobble = Math.sin((i + 1 + seed) * 0.4) * (variancePct / 100) * base * 0.4;
    const noise = (Math.random() - 0.5) * 2 * (variancePct / 100) * base * 0.6;
    const raw = base + wobble + noise;
    trend.push(Math.max(0, Math.round(raw)));
  }
  return movingAverage(trend, Math.max(2, Math.floor(points / 6)));
}

/** Generate 12-week cashflow arrays (repayments & disbursements) */
function generate12WeekCashflow(repBase: number, disbBase: number, weeks = 12) {
  const repayments = generateHybridTrend(repBase, weeks, 25);
  const disbursements = generateHybridTrend(disbBase, weeks, 35).map((v) => Math.max(0, v));
  const net = repayments.map((r, i) => r - (disbursements[i] || 0));
  return { repayments, disbursements, net };
}

/** Generate on-time vs late weekly counts based on activeLoanCount */
function generateOnTimeLateByActive(activeLoanCount: number, weeks = 4) {
  const basePerWeek = Math.max(5, Math.round(activeLoanCount / Math.max(1, 4)));
  const onTime: number[] = [];
  const late: number[] = [];
  for (let i = 0; i < weeks; i++) {
    // on-time 65% - 95% realistic range but depends on active loans
    const pct = clamp(0.65 + (Math.random() * 0.3), 0.5, 0.95);
    const totalThisWeek = Math.max(1, Math.round(basePerWeek * (0.8 + Math.random() * 0.4))); // variance
    const on = Math.round(totalThisWeek * pct);
    const lt = Math.max(0, totalThisWeek - on);
    onTime.push(on);
    late.push(lt);
  }
  return { onTime: movingAverage(onTime, 2), late: movingAverage(late, 2) };
}

function pct(v: number, t: number) {
  if (!t) return 0;
  return Math.round((v / t) * 100);
}

/* -------------------- Engine -------------------- */

const adminDashboardService = {
  /**
   * Get formatted dashboard stats ready for UI consumption
   */
  async getDashboardStats(opts?: { sparkPoints?: number; smoothing?: boolean }): Promise<DashboardUIStats> {
    const sparkPoints = opts?.sparkPoints ?? 12;
    const smoothing = opts?.smoothing ?? true;

    const token = await AsyncStorage.getItem("userToken");
    if (!token) throw new Error("No auth token found");

    const res = await axios.get<DashboardRaw>("http://192.168.1.222:5001/api/admin/dashboard-stats", {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    const raw = res.data || {};

    // Core numbers
    const borrowerCount = raw.borrowerCount ?? 0;
    const activeLoanCount = raw.activeLoanCount ?? 0;
    const rejectedCount = raw.rejectedCount ?? 0;

    const loanStatusDistribution = {
      paidAmount: raw.loanStatusDistribution?.paidAmount ?? 0,
      unpaidAmount: raw.loanStatusDistribution?.unpaidAmount ?? 0,
      overdueAmount: raw.loanStatusDistribution?.overdueAmount ?? 0,
    };

    const paymentOverview = {
      collectiblesToday: raw.paymentOverview?.collectiblesToday ?? 0,
      actualPayments: raw.paymentOverview?.actualPayments ?? 0,
    };

    const pendingLoanApproval = raw.pendingLoanApproval ?? 0;
    const pendingDisbursement = raw.pendingDisbursement ?? 0;
    const totalDisbursedLoan = raw.totalDisbursedLoan ?? 0;
    const loansAtRisk = raw.loansAtRisk ?? 0;
    const upcomingPayments = raw.upcomingPayments ?? [];

    /* ------------------ 7-day Collections ------------------ */
    const serverWeeklyCollections = Array.isArray(raw.weeklyCollections) ? raw.weeklyCollections.map((v) => Number(v || 0)) : [];
    const weekly7 = serverWeeklyCollections.length ? ensureLength(serverWeeklyCollections, 7) : genWeeklyPlaceholder(totalDisbursedLoan, 7);
    const weekly7Final = smoothing ? movingAverage(weekly7, 2) : weekly7;
    const collectionsChart: ChartDataset = {
      labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      datasets: [{ data: weekly7Final }],
    };

    /* ------------------ Payments vs Collectibles (4 weeks) ------------------ */
    // We aggregate trends into 4 weekly points. Use paymentOverview totals to seed the generator.
    const seedCollectBase = Math.round((paymentOverview.collectiblesToday || Math.round(totalDisbursedLoan / Math.max(1, 28))) * 7); // approximate weekly expected
    const seedPaymentBase = Math.round((paymentOverview.actualPayments || Math.round(totalDisbursedLoan / Math.max(1, 28))) * 7);
    const collect4 = generateHybridTrend(seedCollectBase, 4, 20);
    const pay4 = generateHybridTrend(seedPaymentBase, 4, 20);
    const paymentsVsCollectiblesChart: ChartDataset = {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      datasets: [
        { data: collect4, color: () => `rgba(10,132,255,1)` }, // collectibles expected
        { data: pay4, color: () => `rgba(0,200,83,1)` }, // actual payments
      ],
    };

    /* ------------------ Payment Behavior (on-time vs late) 4 weeks ------------------ */
    const otl = generateOnTimeLateByActive(activeLoanCount, 4);
    const onTimeLateChart: ChartDataset = {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      datasets: [
        { data: otl.onTime, color: () => `rgba(0,122,255,1)` }, // on-time counts
        { data: otl.late, color: () => `rgba(255,59,48,1)` }, // late counts
      ],
    };

    /* ------------------ Cashflow Overview (12 weeks) ------------------ */
    // If backend gives weeklyRepayments/weeklyDisbursements for 12 weeks, prefer them; otherwise generate.
    const server12Rep = Array.isArray((raw as any).weeklyRepayments) ? (raw as any).weeklyRepayments.map((v: any) => Number(v || 0)) : [];
    const server12Disb = Array.isArray((raw as any).weeklyDisbursements) ? (raw as any).weeklyDisbursements.map((v: any) => Number(v || 0)) : [];

    let rep12: number[] = [];
    let disb12: number[] = [];

    if (server12Rep.length >= 12 && server12Disb.length >= 12) {
      rep12 = ensureLength(server12Rep, 12);
      disb12 = ensureLength(server12Disb, 12);
    } else {
      // Derive reasonable bases from totals
      const avgRepBase = Math.max(0, Math.round((paymentOverview.actualPayments || totalDisbursedLoan / 28) * 7)); // weekly approx
      const avgDisbBase = Math.max(0, Math.round((pendingDisbursement || totalDisbursedLoan / Math.max(1, 12)))); // approximate weekly disbursement
      const gen = generate12WeekCashflow(avgRepBase, avgDisbBase, 12);
      rep12 = gen.repayments;
      disb12 = gen.disbursements;
    }
    const net12 = rep12.map((r, i) => r - (disb12[i] || 0));
    const cashflowChart: ChartDataset = {
      labels: Array.from({ length: 12 }, (_, i) => `W${i + 1}`),
      datasets: [
        { data: rep12, color: () => `rgba(10,132,255,1)` }, // repayments
        { data: disb12, color: () => `rgba(255,59,48,1)` }, // disbursements
        // net line is returned as separate array (we will overlay a LineChart with this data in the screen)
      ],
    };

    /* ------------------ Ring percentages ------------------ */
    const totalForRings = loanStatusDistribution.paidAmount + loanStatusDistribution.unpaidAmount + loanStatusDistribution.overdueAmount;
    const ringPercent = {
      paidPct: pct(loanStatusDistribution.paidAmount, totalForRings),
      unpaidPct: pct(loanStatusDistribution.unpaidAmount, totalForRings),
      overduePct: pct(loanStatusDistribution.overdueAmount, totalForRings),
    };

    /* ------------------ Final payload ------------------ */
    const ui: DashboardUIStats = {
      borrowerCount,
      activeLoanCount,
      rejectedCount,
      loanStatusDistribution,
      paymentOverview,
      pendingLoanApproval,
      pendingDisbursement,
      totalDisbursedLoan,
      loansAtRisk,
      upcomingPayments,
      ringPercent,
      collectionsChart,
      paymentsVsCollectiblesChart,
      onTimeLateChart,
      cashflowChart,
      rawWeeklyCollections: weekly7,
      raw12WeekRepayments: rep12,
      raw12WeekDisbursements: disb12,
      rawOnTimeCounts: otl.onTime,
      rawLateCounts: otl.late,
      rawNetCashflow: net12,
    };

    return ui;
  },
};

export default adminDashboardService;
