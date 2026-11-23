ALTER TABLE students ADD COLUMN billing_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fee_invoices ADD COLUMN due_date_overridden INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fee_payments ADD COLUMN idempotency_key TEXT;
ALTER TABLE fee_payments ADD COLUMN allocations_json TEXT;

CREATE UNIQUE INDEX idx_fee_payments_idempotency ON fee_payments(idempotency_key);
CREATE INDEX idx_fee_invoices_due_date ON fee_invoices(due_date);

-- Move open bills for the current tuition month to the following payment month.
-- Existing paid and waived bills keep their recorded dates and status.
UPDATE fee_invoices AS invoice
SET due_date = date(invoice.month_key || '-01', '+1 month', printf('+%d days', min(
      COALESCE(student.monthly_payment_day, student.fee_due_day),
      CAST(strftime('%d', date(invoice.month_key || '-01', '+2 months', '-1 day')) AS INTEGER)
    ) - 1)),
    status = CASE WHEN invoice.paid_amount_paise > 0 THEN 'partial' ELSE 'unpaid' END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM students AS student
WHERE student.id = invoice.student_id
  AND invoice.month_key >= strftime('%Y-%m', 'now', '+330 minutes')
  AND substr(invoice.due_date, 1, 7) = invoice.month_key
  AND invoice.status IN ('unpaid', 'partial', 'overdue')
  AND invoice.paid_amount_paise < invoice.total_amount_paise;

CREATE TRIGGER fee_invoice_insert_revision AFTER INSERT ON fee_invoices BEGIN
  UPDATE students SET billing_revision = billing_revision + 1 WHERE id = NEW.student_id;
END;

CREATE TRIGGER fee_invoice_update_revision AFTER UPDATE OF due_date, status, paid_amount_paise, total_amount_paise ON fee_invoices BEGIN
  UPDATE students SET billing_revision = billing_revision + 1 WHERE id = NEW.student_id;
END;

CREATE TRIGGER fee_invoice_delete_revision AFTER DELETE ON fee_invoices BEGIN
  UPDATE students SET billing_revision = billing_revision + 1 WHERE id = OLD.student_id;
END;

CREATE TRIGGER fee_credit_revision AFTER UPDATE OF credit_balance_paise ON students
WHEN OLD.credit_balance_paise <> NEW.credit_balance_paise BEGIN
  UPDATE students SET billing_revision = billing_revision + 1 WHERE id = NEW.id;
END;
