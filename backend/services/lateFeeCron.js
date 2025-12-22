// services/lateFeeCron.js
const cron = require("node-cron");
const db = require("../db");
const {
  markOverdueInstallments,
  applyLateFeesIfNeeded,
  recalcLoanRemainingBalance,
} = require("./repaymentEngine");

/**
 * DAILY LATE FEE CRON — KAURta (AUTHORITATIVE)
 *
 * Rules:
 * - Runs once per day (12:05 AM)
 * - Marks overdue installments first
 * - Escalates loan to OVERDUE after 2 consecutive missed days
 * - Applies ₱1000 late fee per 2-day block
 * - Idempotent (safe to rerun)
 */

// 12:05 AM daily
const CRON_SCHEDULE = "5 0 * * *";

function startLateFeeCron() {
  cron.schedule(CRON_SCHEDULE, async () => {
    console.log("🕛 [CRON] Late fee enforcement started");

    const client = await db.connect();
    try {
      // Fetch ACTIVE loans only
      const loansQ = await client.query(`
        SELECT id, user_id
        FROM loans
        WHERE LOWER(status) = 'active'
      `);

      for (const loan of loansQ.rows) {
        try {
          // 1️⃣ Mark overdue repayment_schedule rows
          await markOverdueInstallments(loan.id);

          // 2️⃣ Count overdue days
          const overdueQ = await client.query(
            `
            SELECT COUNT(*)::int AS overdue_days
            FROM repayment_schedule
            WHERE loan_id = $1
              AND status = 'overdue'
            `,
            [loan.id]
          );

          const overdueDays = overdueQ.rows[0]?.overdue_days || 0;

          // 3️⃣ Escalate loan to OVERDUE if >= 2 days
          if (overdueDays >= 2) {
            await client.query(
              `
              UPDATE loans
              SET status = 'overdue'
              WHERE id = $1
                AND LOWER(status) = 'active'
              `,
              [loan.id]
            );
          }

          // 4️⃣ Apply late fee (₱1000 per 2 consecutive days)
          await applyLateFeesIfNeeded(loan.id, loan.user_id, {
            lateFeeAmount: 1000,
            threshold: 2,
          });

          // 5️⃣ Recalculate balances
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
