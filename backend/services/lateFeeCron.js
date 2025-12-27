// services/lateFeeCron.js
const cron = require("node-cron");
const db = require("../db");
const {
  applyLateFeesIfNeeded,
  recalcLoanRemainingBalance,
} = require("./repaymentEngine");

/**
 * DAILY LATE FEE CRON — KAURta (FINAL / AUTHORITATIVE)
 *
 * CORE PRINCIPLES:
 * - Loan status NEVER becomes "overdue"
 * - Overdue is DERIVED from latest_due_date
 * - Late fees use BLOCK-RESET model
 * - Payments advance latest_due_date and immediately restore currency
 *
 * CRON RESPONSIBILITY:
 * - Apply late fees if earned
 * - Recalculate balances
 * - NOTHING ELSE
 */

// Runs daily at 12:05 AM
const CRON_SCHEDULE = "5 0 * * *";

function startLateFeeCron() {
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log("🕛 [CRON] Late fee enforcement started");

    const client = await db.connect();
    try {
      // Only ACTIVE loans are evaluated
      const loansQ = await client.query(`
        SELECT id, user_id
        FROM loans
        WHERE LOWER(status) = 'active'
      `);

      for (const loan of loansQ.rows) {
        try {
          // 1️⃣ Apply late fees if earned (BLOCK-RESET model)
          await applyLateFeesIfNeeded(loan.id, loan.user_id, {
            lateFeeAmount: 1000,
          });

          // 2️⃣ Recalculate balances (idempotent & safe)
          await recalcLoanRemainingBalance(loan.id, client);
        } catch (loanErr) {
          console.error(
            `❌ [CRON] Loan ${loan.id} failed:`,
            loanErr.message
          );
        }
      }

      console.log("✅ [CRON] Late fee enforcement completed");
    } catch (err) {
      console.error("❌ [CRON] Fatal error:", err);
    } finally {
      client.release();
    }
  });

  console.log("⏱️ Late fee cron scheduled (daily @ 12:05 AM)");
}

module.exports = startLateFeeCron;
