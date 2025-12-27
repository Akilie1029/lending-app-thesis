// backend/controllers/loanController.js
const db = require("../db");

const LOG_PREFIX = "[LOAN_CONTROLLER]";

/**
 * Apply for loan (controller style)
 */
exports.applyForLoan = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      principal,
      days,
      purpose,
      full_name,
      date_of_birth,
      address,
      phone_number,
      employment_status,
      company_name,
      monthly_income_range,
      payout_method,
      payout_details,
      government_id_local_uri,
      selfie_with_id_local_uri,
      proof_of_funds_local_uri,
    } = req.body;

    if (!principal || !purpose || !days) {
      return res.status(400).json({
        error: "MISSING_FIELDS",
        message: "principal, days and purpose required",
      });
    }

    const existing = await db.query(
      "SELECT id FROM loans WHERE user_id = $1 AND LOWER(COALESCE(status,'')) = 'active' LIMIT 1",
      [userId]
    );

    if (existing.rows.length) {
      return res.status(400).json({ error: "ACTIVE_LOAN_EXISTS" });
    }

    // 5-6 system
    const interest = Number((principal * 0.2).toFixed(2));
    const total_payable = Number((principal + interest).toFixed(2));
    const daily_payment = Number((total_payable / days).toFixed(2));
    const remaining_balance = total_payable;

    const result = await db.query(
      `
      INSERT INTO loans (
        id, user_id, amount_requested, principal, days, purpose,
        status, created_at,
        full_name, date_of_birth, address, phone_number,
        employment_status, company_name, monthly_income_range,
        payout_method, payout_details,
        gov_id_uri, selfie_id_uri, proof_uri
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5,
        'pending', NOW(),
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14,
        $15, $16, $17
      )
      RETURNING *
      `,
      [
        userId,
        principal,
        principal,
        days,
        purpose,
        full_name,
        date_of_birth,
        address,
        phone_number,
        employment_status,
        company_name,
        monthly_income_range,
        payout_method,
        payout_details,
        government_id_local_uri,
        selfie_with_id_local_uri,
        proof_of_funds_local_uri,
      ]
    );

    await db.query(
      `
      UPDATE loans
      SET interest = $1,
          total_payable = $2,
          daily_payment = $3,
          remaining_balance = $4
      WHERE id = $5
      `,
      [interest, total_payable, daily_payment, remaining_balance, result.rows[0].id]
    );

    console.log(LOG_PREFIX, "✅ Loan INSERT Success:", result.rows[0]?.id);

    return res.status(201).json({
      message: "Loan submitted successfully",
      loan: result.rows[0],
    });
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Error in applyForLoan:", err);
    return res.status(500).json({ error: "Server Error", message: err.message });
  }
};

/**
 * Borrower: Get my loans (WITH late fee transparency)
 */
exports.getMyLoans = async (req, res) => {
  try {
    const userId = req.user.id;

    const loansRes = await db.query(
      `
      SELECT *
      FROM loans
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    const loans = loansRes.rows;

    // Attach late fee transparency per loan
    for (const loan of loans) {
      const lateFeeAgg = await db.query(
        `
        SELECT
          COALESCE(SUM(amount), 0) AS total_late_fees
        FROM repayment_history
        WHERE loan_id = $1
          AND is_late_fee = TRUE
        `,
        [loan.id]
      );

      const lateFeeItems = await db.query(
        `
        SELECT
          amount,
          created_at
        FROM repayment_history
        WHERE loan_id = $1
          AND is_late_fee = TRUE
        ORDER BY created_at ASC
        `,
        [loan.id]
      );

      loan.late_fees = {
        total: Number(lateFeeAgg.rows[0]?.total_late_fees || 0),
        breakdown: lateFeeItems.rows,
      };
    }

    return res.json(loans);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Error in getMyLoans:", err);
    return res.status(500).send("Server Error");
  }
};

exports.getAllLoans = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM loans ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Error in getAllLoans:", err);
    res.status(500).send("Server Error");
  }
};

/**
 * Approve loan (admin)
 */
exports.approveLoan = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(LOG_PREFIX, "➡️ approveLoan called by admin:", req.user?.id, "loanId:", id);

    if (!id) return res.status(400).json({ error: "MISSING_ID" });

    const loanRes = await db.query("SELECT * FROM loans WHERE id = $1 LIMIT 1", [id]);
    if (!loanRes.rows.length) {
      return res.status(404).json({ message: "Loan not found" });
    }

    const loan = loanRes.rows[0];
    const curStatus = (loan.status || "").toLowerCase();

    if (["active", "completed", "paid", "rejected"].includes(curStatus)) {
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: `Cannot approve loan in status: ${loan.status}`,
      });
    }

    const rawApproved =
      req.body && req.body.approved_principal !== undefined
        ? req.body.approved_principal
        : null;

    const fallbackPrincipal = loan.principal ?? loan.amount_requested ?? 0;
    const approvedPrincipal = Number(rawApproved ?? fallbackPrincipal);

    if (!approvedPrincipal || approvedPrincipal <= 0) {
      return res.status(400).json({
        error: "INVALID_APPROVED_PRINCIPAL",
      });
    }

    const approvedInterest = Number((approvedPrincipal * 0.2).toFixed(2));
    const approvedTotalPayable = Number((approvedPrincipal + approvedInterest).toFixed(2));
    const days = Number(loan.days || 0);
    const approvedDailyPayment = days > 0
      ? Number((approvedTotalPayable / days).toFixed(2))
      : null;

    const updated = await db.query(
      `
      UPDATE loans
      SET
        approved_principal = $1,
        approved_total_payable = $2,
        approved_daily_payment = $3,
        approved_at = NOW(),
        status = 'approved_pending_disburse'
      WHERE id = $4
      RETURNING *
      `,
      [approvedPrincipal, approvedTotalPayable, approvedDailyPayment, id]
    );

    return res.json(updated.rows[0]);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Error in approveLoan:", err);
    return res.status(500).send("Server Error");
  }
};

exports.rejectLoan = async (req, res) => {
  try {
    const { id } = req.params;
    const note = req.body?.note || "";

    const updated = await db.query(
      `
      UPDATE loans
      SET status = 'rejected',
          notes = COALESCE(notes, '') || $2
      WHERE id = $1
      RETURNING *
      `,
      [id, note]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ message: "Loan not found" });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(LOG_PREFIX, "❌ Error in rejectLoan:", err);
    res.status(500).send("Server Error");
  }
};
