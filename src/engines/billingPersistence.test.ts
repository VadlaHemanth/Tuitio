import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { monthlyBillStatements, type BillingStatement } from '../../server/billing';
import { buildDemoDataset, createDefaultSettings } from '../../server/demoSeed';
import { buildDueDateForMonth, formatIstMonthKey, nextMonthKey } from './istDate';

const migrations = ['0001_initial.sql', '0002_monthly_payment_reminders.sql', '0003_monthly_billing.sql'];
const sql = (name: string) => readFileSync(`cloudflare/migrations/${name}`, 'utf8');

function enroll(db: DatabaseSync, id: string, admission: string, credit = 0) {
  db.prepare(`INSERT INTO students (id, student_code, full_name, avatar_color, class_level, board, admission_date,
    parent_name, parent_phone, monthly_payment_day, credit_balance_paise, created_at, updated_at)
    VALUES (?, ?, ?, '', 3, 'SSC', ?, '', '', 31, ?, '', '')`).run(id, id, id, admission, credit);
}

test('migration moves current open charges into the following month and preserves settled dates', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const migration of migrations.slice(0, 2)) db.exec(sql(migration));
    const current = formatIstMonthKey();
    for (const [id, paid, status] of [['partial', 25_000, 'overdue'], ['paid', 50_000, 'paid'], ['waived', 0, 'waived']] as const) {
      enroll(db, id, `${current}-01`);
      db.prepare(`INSERT INTO fee_invoices (id, student_id, month_key, class_level_snapshot, board_snapshot, base_amount_paise,
        board_surcharge_paise, total_amount_paise, paid_amount_paise, due_date, status, created_at, updated_at)
        VALUES (?, ?, ?, 3, 'SSC', 50000, 0, 50000, ?, ?, ?, '', '')`).run(id, id, current, paid, `${current}-05`, status);
    }
    db.exec(sql(migrations[2]));
    const get = db.prepare('SELECT due_date, paid_amount_paise, status FROM fee_invoices WHERE id = ?');
    assert.deepEqual({ ...get.get('partial') }, { due_date: buildDueDateForMonth(nextMonthKey(current), 31), paid_amount_paise: 25_000, status: 'partial' });
    assert.equal(get.get('paid')?.due_date, `${current}-05`);
    assert.equal(get.get('waived')?.due_date, `${current}-05`);
  } finally {
    db.close();
  }
});

test('retried bill creation spends advance credit only once and carries unused credit forward', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const migration of migrations) db.exec(sql(migration));
    const student = {
      ...buildDemoDataset().students[0], id: 'advance', classLevel: 3 as const, board: 'SSC' as const, status: 'active' as const,
      admissionDate: '2027-01-01', isDemo: false, feeDueDay: 1, feeOverride: null, creditBalancePaise: 90_000,
    };
    enroll(db, student.id, student.admissionDate, student.creditBalancePaise);
    const state = { students: [student], settings: createDefaultSettings(), discounts: [], invoices: [], todayIst: '2027-01-01' };
    const apply = (statements: BillingStatement[]) => {
      db.exec('BEGIN');
      for (const { sql: statement, values } of statements) db.prepare(statement).run(...values);
      db.exec('COMMIT');
    };
    const readCredit = db.prepare('SELECT credit_balance_paise FROM students WHERE id = ?');
    apply(monthlyBillStatements(state, '2027-01', () => 'first', '2027-01-01').flat());
    apply(monthlyBillStatements(state, '2027-01', () => 'retry', '2027-01-01').flat());
    assert.equal(readCredit.get(student.id)?.credit_balance_paise, 40_000);
    apply(monthlyBillStatements({ ...state, todayIst: '2027-02-01' }, '2027-02', () => 'second', '2027-02-01').flat());
    assert.equal(readCredit.get(student.id)?.credit_balance_paise, 0);
    const invoices = db.prepare('SELECT due_date, paid_amount_paise FROM fee_invoices ORDER BY month_key').all().map((row) => ({ ...row }));
    assert.deepEqual(invoices, [{ due_date: '2027-02-01', paid_amount_paise: 50_000 }, { due_date: '2027-03-01', paid_amount_paise: 40_000 }]);
  } finally {
    db.close();
  }
});
