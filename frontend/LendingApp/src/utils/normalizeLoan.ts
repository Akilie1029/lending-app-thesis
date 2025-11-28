// src/utils/normalizeLoan.ts
export function normalizeLoan(raw: any) {
  if (!raw) return {};

  return {
    id: String(raw.id ?? raw.loan_id ?? ""),
    user_id: raw.user_id ?? raw.borrower_id ?? null,

    // borrower information
    full_name: raw.full_name ?? raw.name ?? raw.borrower_name ?? "Unknown",
    email: raw.email ?? null,

    // loan details
    amount: Number(
      raw.amount ??
        raw.amount_requested ??
        raw.principal ??
        0
    ),

    principal: Number(
      raw.principal ??
        raw.amount_requested ??
        raw.amount ??
        0
    ),

    purpose: raw.purpose ?? "",
    days: Number(raw.days ?? raw.term ?? 0),

    total_payable: Number(
      raw.total_payable ??
        raw.total_amount ??
        raw.total ??
        0
    ),

    daily_payment: Number(
      raw.daily_payment ??
        raw.daily ??
        raw.daily_rate ??
        0
    ),

    remaining_balance: Number(
      raw.remaining_balance ??
        raw.balance ??
        raw.remaining ??
        raw.total_payable ?? 0
    ),

    status: raw.status ?? raw.loan_status ?? "pending",

    // timestamps
    created_at: raw.created_at ?? raw.date_created ?? null,
    approved_at: raw.approved_at ?? null,
    disbursed_at: raw.disbursed_at ?? null,
    completion_date: raw.completion_date ?? raw.paid_at ?? null,
  };
}
