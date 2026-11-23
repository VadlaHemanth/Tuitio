import { z } from 'zod';
import { allocatePaymentToInvoices, buildMonthlyInvoiceDraft, computeInvoiceStatus, type buildNextDayFeeReminders } from '../src/engines/feeEngine';
import type { FeeInvoice, WorkspaceSnapshot } from '../src/types';

type BillingState = Pick<WorkspaceSnapshot, 'students' | 'discounts' | 'invoices' | 'settings' | 'todayIst'>;

export interface BillingStatement {
  sql: string;
  values: (string | number | null)[];
}

export const billingMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const invoicePatchSchema = z.object({
  dueDate: z.iso.date().optional(),
  waived: z.boolean().optional(),
}).refine((value) => value.dueDate !== undefined || value.waived !== undefined);

export const paymentSchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().min(1).nullable().optional(),
  throughMonth: billingMonthSchema.optional(),
  amountPaise: z.number().int().positive(),
  paymentDate: z.iso.date().optional(),
  method: z.enum(['cash', 'upi', 'bank_transfer', 'other']),
  transactionRef: z.string().max(80).default(''),
  notes: z.string().max(300).default(''),
  idempotencyKey: z.string().min(1).max(80).optional(),
});

export type PaymentInput = z.output<typeof paymentSchema>;

export function monthlyBillStatements(state: BillingState, month: string, makeId: () => string, now: string): BillingStatement[][] {
  const billed = new Set(state.invoices.filter((invoice) => invoice.monthKey === month).map((invoice) => invoice.studentId));
  return state.students.flatMap((student) => {
    if (billed.has(student.id)) return [];
    const draft = buildMonthlyInvoiceDraft({
      student, monthKey: month, feeConfig: state.settings.feeConfig, discounts: state.discounts,
      existingInvoices: [], todayDate: state.todayIst,
    });
    if (!draft) return [];
    const id = makeId();
    return [[{
      sql: `WITH credit AS (
        SELECT min(max(0, credit_balance_paise), ?) AS applied FROM students
        WHERE id = ? AND status = 'active' AND substr(admission_date, 1, 7) <= ?
      )
      INSERT INTO fee_invoices (
        id, student_id, month_key, class_level_snapshot, board_snapshot, base_amount_paise,
        board_surcharge_paise, override_applied, discount_paise, discount_summary,
        total_amount_paise, paid_amount_paise, due_date, status, notes, is_demo, created_at, updated_at
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, applied, ?, CASE
        WHEN applied >= ? THEN 'paid' WHEN ? < ? THEN 'overdue' WHEN applied > 0 THEN 'partial' ELSE 'unpaid' END,
        CASE WHEN applied > 0 THEN 'Advance credit applied' ELSE '' END, ?, ?, ?
      FROM credit WHERE 1 ON CONFLICT(student_id, month_key) DO NOTHING`,
      values: [draft.totalAmountPaise, student.id, month, id, student.id, month, draft.classLevelSnapshot,
        draft.boardSnapshot, draft.baseAmountPaise, draft.boardSurchargePaise, Number(draft.overrideApplied),
        draft.discountPaise, draft.discountSummary, draft.totalAmountPaise, draft.dueDate, draft.totalAmountPaise,
        draft.dueDate, state.todayIst, Number(Boolean(student.isDemo)), now, now],
    }, {
      sql: `UPDATE students SET credit_balance_paise = credit_balance_paise -
        (SELECT paid_amount_paise FROM fee_invoices WHERE id = ?), updated_at = ?
        WHERE id = ? AND EXISTS (SELECT 1 FROM fee_invoices WHERE id = ? AND paid_amount_paise > 0)`,
      values: [id, now, student.id, id],
    }]];
  });
}

export function invoiceAdjustment(id: string, patch: z.output<typeof invoicePatchSchema>, today: string, now: string): BillingStatement {
  const due = patch.dueDate ?? null;
  const waive = patch.waived === undefined ? null : Number(patch.waived);
  return {
    sql: `UPDATE fee_invoices SET
      due_date = COALESCE(?, due_date),
      due_date_overridden = CASE WHEN ? IS NOT NULL THEN 1 ELSE due_date_overridden END,
      status = CASE WHEN COALESCE(?, status = 'waived') THEN 'waived'
        WHEN paid_amount_paise >= total_amount_paise THEN 'paid'
        WHEN COALESCE(?, due_date) < ? THEN 'overdue'
        WHEN paid_amount_paise > 0 THEN 'partial' ELSE 'unpaid' END,
      updated_at = ? WHERE id = ?`,
    values: [due, due, waive, due, today, now, id],
  };
}

export function feeReminderStatements(
  reminders: ReturnType<typeof buildNextDayFeeReminders>,
  today: string,
  now: string,
  makeId: () => string,
): BillingStatement[] {
  return [{
    sql: `DELETE FROM notifications WHERE category = 'fee_due' AND scheduled_for = ?
      AND dedup_key LIKE 'fee:%:before-1-day:%' AND dedup_key NOT IN (SELECT value FROM json_each(?))`,
    values: [today, JSON.stringify(reminders.map((reminder) => reminder.dedupKey))],
  }, ...reminders.map((reminder) => ({
    sql: `INSERT INTO notifications (id, category, title, message, student_id, priority, dedup_key, scheduled_for, created_at)
      VALUES (?, 'fee_due', ?, ?, ?, 'high', ?, ?, ?)
      ON CONFLICT(dedup_key) DO UPDATE SET title = excluded.title, message = excluded.message
      WHERE notifications.title <> excluded.title OR notifications.message <> excluded.message`,
    values: [makeId(), reminder.title, reminder.message, reminder.studentId ?? null, reminder.dedupKey, today, now],
  }))];
}

export type PaymentReceipt = { id: string; student_id: string; amount_paise: number; receipt_number: string };
export const paymentReceiptColumns = 'id, student_id, amount_paise, receipt_number';

export function paymentStatements(data: PaymentInput, invoices: FeeInvoice[], revision: number, id: string, today: string, now: string): BillingStatement[] {
  const paymentDate = data.paymentDate ?? today;
  const year = paymentDate.slice(0, 4);
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const { allocations, remainingAdvanceCreditPaise } = allocatePaymentToInvoices({
    invoices: invoices.filter((invoice) => invoice.id === data.invoiceId || invoice.monthKey <= (data.throughMonth ?? today.slice(0, 7))),
    paymentAmountPaise: data.amountPaise, todayDate: today, targetInvoiceId: data.invoiceId,
  });
  const breakdown = allocations.map((line) => ({ monthKey: byId.get(line.invoiceId)!.monthKey, amountPaise: line.appliedPaise }));
  const statements: BillingStatement[] = [{
    sql: `INSERT INTO fee_payments (id, invoice_id, student_id, amount_paise, payment_date, method, transaction_ref,
      receipt_number, notes, is_advance, is_demo, created_at, idempotency_key, allocations_json)
      SELECT ?, ?, id, ?, ?, ?, ?, printf('RCPT-%s-%04d', ?, (
        SELECT COALESCE(MAX(CAST(substr(receipt_number, 11) AS INTEGER)), 100) + 1
        FROM fee_payments WHERE substr(receipt_number, 6, 4) = ?
      )), ?, ?, is_demo, ?, ?, ? FROM students WHERE id = ? AND billing_revision = ?
      ON CONFLICT(idempotency_key) DO NOTHING`,
    values: [id, allocations[0]?.invoiceId ?? null, data.amountPaise, paymentDate, data.method, data.transactionRef,
      year, year, data.notes, Number(remainingAdvanceCreditPaise > 0), now, data.idempotencyKey ?? null,
      JSON.stringify(breakdown), data.studentId, revision],
  }];

  for (const allocation of allocations) {
    statements.push({
      sql: `UPDATE fee_invoices SET paid_amount_paise = ?, status = ?, updated_at = ?
        WHERE id = ? AND EXISTS (SELECT 1 FROM fee_payments WHERE id = ?)`,
      values: [allocation.newPaidPaise, allocation.newStatus, now, allocation.invoiceId, id],
    });
  }
  if (remainingAdvanceCreditPaise > 0) {
    statements.push({
      sql: `UPDATE students SET credit_balance_paise = credit_balance_paise + ?, updated_at = ?
        WHERE id = ? AND EXISTS (SELECT 1 FROM fee_payments WHERE id = ?)`,
      values: [remainingAdvanceCreditPaise, now, data.studentId, id],
    });
  }
  return statements;
}

export function mapBillingInvoice(row: Record<string, unknown>, today: string): FeeInvoice {
  const total = Number(row.total_amount_paise);
  const paid = Number(row.paid_amount_paise);
  const dueDate = String(row.due_date);
  return {
    id: String(row.id), studentId: String(row.student_id), monthKey: String(row.month_key),
    classLevelSnapshot: Number(row.class_level_snapshot) as FeeInvoice['classLevelSnapshot'],
    boardSnapshot: String(row.board_snapshot) as FeeInvoice['boardSnapshot'],
    baseAmountPaise: Number(row.base_amount_paise), boardSurchargePaise: Number(row.board_surcharge_paise),
    overrideApplied: Number(row.override_applied) === 1, discountPaise: Number(row.discount_paise),
    discountSummary: String(row.discount_summary ?? ''), totalAmountPaise: total, paidAmountPaise: paid, dueDate,
    status: computeInvoiceStatus(total, paid, dueDate, today, row.status === 'waived'), notes: String(row.notes ?? ''),
    isDemo: Number(row.is_demo) === 1, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}
