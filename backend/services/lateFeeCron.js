const cron = require("node-cron");
const db = require("../db");
const {
  markOverdueInstallments,
  applyLateFeesIfNeeded,
} = require("./repaymentEngine");

/**
 * DAILY LATE FEE CRON — KAURta
 *
 * Rules:
 * - Runs once per day (12:05 AM)
 * - Applies ₱1000 for every 2 consecutive missed days
 * - Uses latest_due_date as borrower-facing truth
 * - Safe to run multiple times (idempotent logic)
 */

// 12:05 AM daily
const CRON_SCHEDULE = "5 0 * * *";

function startLateFeeCron() {
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log("🕛 [CRON] Late fee check started");

    const client = await db.connect();
    try {
      // Fetch ACTIVE loans only
      const loansQ = await client.query(`
        SELECT id, user_id
        FROM loans
        WHERE status = 'active'
      `);

      for (const loan of loansQ.rows) {
        try {
          // 1. Mark overdue installments
          await markOverdueInstallments(loan.id);

          // 2. Apply late fee if threshold met (2 days)
          await applyLateFeesIfNeeded(loan.id, loan.user_id, {
            lateFeeAmount: 1000,
            threshold: 2,
          });
        } catch (loanErr) {
          console.error(
            `[CRON] Loan ${loan.id} processing failed:`,
            loanErr.message
          );
        }
      }

      console.log("✅ [CRON] Late fee check completed");
    } catch (err) {
      console.error("❌ [CRON] Late fee cron failed:", err);
    } finally {
      client.release();
    }
  });

  console.log("⏱️ Late fee cron scheduled (daily @ 12:05 AM)");
}

module.exports = startLateFeeCron;
