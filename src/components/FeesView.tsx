import { StudentName } from './StudentName';
import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  IndianRupee,
  Percent,
  Plus,
  Printer,
  Receipt,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BoardType,
  ClassLevel,
  DiscountKind,
  DiscountScope,
  FeeInvoice,
  FeePayment,
  PaymentMethod,
  Student,
  WorkspaceSnapshot,
} from '../types';
import { allocatePaymentToInvoices, evaluateFeeReminders, getEarlierBalances, invoiceBalance } from '../engines/feeEngine';
import { buildDueDateForMonth, formatRupeesFromPaise, getMonthLabel, nextMonthKey, prevMonthKey } from '../engines/istDate';
import { downloadCsv } from '../lib/api';

interface FeesViewProps {
  workspace: WorkspaceSnapshot;
  initialPaymentStudentId: string | null;
  onClearInitialPaymentStudent: () => void;
  onRecordPayment: (payload: {
    studentId: string;
    invoiceId?: string | null;
    throughMonth?: string;
    amountPaise: number;
    method: PaymentMethod;
    transactionRef: string;
    notes: string;
    idempotencyKey: string;
  }) => Promise<void>;
  onEditInvoice: (invoiceId: string, patch: InvoiceEdit) => Promise<void>;
  onCreateDiscount: (payload: Record<string, unknown>) => Promise<void>;
  onDeleteDiscount: (id: string) => Promise<void>;
}

type InvoiceEdit = { dueDate?: string; waived?: boolean };

type FeesSubTab = 'collection' | 'reminders' | 'discounts' | 'history';

export const FeesView: React.FC<FeesViewProps> = ({
  workspace,
  initialPaymentStudentId,
  onClearInitialPaymentStudent,
  onRecordPayment,
  onEditInvoice,
  onCreateDiscount,
  onDeleteDiscount,
}) => {
  const [tab, setTab] = useState<FeesSubTab>('collection');
  const [requestedMonth, setRequestedMonth] = useState<string | null>(null);
  const previousMonth = prevMonthKey(workspace.currentMonthIst);
  const defaultMonth = workspace.invoices.some((invoice) => invoice.monthKey === previousMonth) ? previousMonth : workspace.currentMonthIst;
  const selectedMonth = requestedMonth ?? defaultMonth;
  const [statusFilter, setStatusFilter] = useState<'all' | FeeInvoice['status']>('all');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const editingInvoice = workspace.invoices.find((invoice) => invoice.id === editingInvoiceId);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Payment modal state
  const [paymentModalStudentId, setPaymentModalStudentId] = useState<string | null>(initialPaymentStudentId);
  const [paymentModalInvoiceId, setPaymentModalInvoiceId] = useState<string | null>(null);
  const [paymentThroughMonth, setPaymentThroughMonth] = useState<string | null>(null);
  const [receiptPayment, setReceiptPayment] = useState<FeePayment | null>(null);

  // Discount modal state
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const studentMap = useMemo(
    () => new Map(workspace.students.map((s) => [s.id, s])),
    [workspace.students],
  );

  const availableMonths = useMemo(() => {
    const set = new Set<string>([workspace.currentMonthIst]);
    for (const inv of workspace.invoices) set.add(inv.monthKey);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [workspace.invoices, workspace.currentMonthIst]);

  const monthInvoices = useMemo(() => {
    return workspace.invoices.filter((inv) => {
      if (inv.monthKey !== selectedMonth) return false;
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      return true;
    });
  }, [workspace.invoices, selectedMonth, statusFilter]);

  const earlierBalances = useMemo(() => getEarlierBalances(workspace.invoices, selectedMonth), [workspace.invoices, selectedMonth]);
  const summary = useMemo(() => {
    const list = workspace.invoices.filter((invoice) => invoice.monthKey === selectedMonth);
    return {
      billed: list.reduce((sum, invoice) => sum + (invoice.status === 'waived' ? invoice.paidAmountPaise : invoice.totalAmountPaise), 0),
      collected: list.reduce((sum, invoice) => sum + invoice.paidAmountPaise, 0),
      remaining: list.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0),
      earlier: [...earlierBalances.values()].reduce((sum, balance) => sum + balance, 0),
    };
  }, [workspace.invoices, selectedMonth, earlierBalances]);

  const feeReminders = useMemo(
    () =>
      evaluateFeeReminders({
        students: workspace.students,
        invoices: workspace.invoices,
        todayDate: workspace.todayIst,
        reminderSettings: workspace.settings.reminders,
        tuitionName: workspace.settings.tuitionName,
      }),
    [workspace],
  );

  const handleExportCsv = () => {
    downloadCsv(
      `tuitio-fees-${selectedMonth}.csv`,
      ['Month', 'Student', 'Class', 'Board', 'Bill (INR)', 'Paid (INR)', 'This Month Balance (INR)', 'Earlier Balance (INR)', 'Total Outstanding (INR)', 'Due Date', 'Status'],
      monthInvoices.map((inv) => {
        const stu = studentMap.get(inv.studentId);
        return [
          inv.monthKey,
          stu?.fullName ?? inv.studentId,
          `Class ${inv.classLevelSnapshot}`,
          inv.boardSnapshot,
          (inv.totalAmountPaise / 100).toFixed(2),
          (inv.paidAmountPaise / 100).toFixed(2),
          (invoiceBalance(inv) / 100).toFixed(2),
          ((earlierBalances.get(inv.studentId) ?? 0) / 100).toFixed(2),
          ((invoiceBalance(inv) + (earlierBalances.get(inv.studentId) ?? 0)) / 100).toFixed(2),
          inv.dueDate,
          inv.status,
        ];
      }),
    );
  };

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Fees & Payments</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Bills appear automatically. Each tuition month is due the following month.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPaymentModalInvoiceId(null);
              setPaymentThroughMonth(null);
              setPaymentModalStudentId(workspace.students.find((s) => s.status === 'active')?.id ?? null);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black whitespace-nowrap"
          >
            <IndianRupee className="w-4 h-4" />
            <span>Record Payment</span>
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-sky-100 dark:divide-white/10 rounded-2xl border border-sky-100 dark:border-white/15 bg-white/80 dark:bg-neutral-950">
        {[
          ['Billed in ' + getMonthLabel(selectedMonth), summary.billed],
          ['Paid on these bills', summary.collected],
          ['Unpaid this month', summary.remaining],
          ['Unpaid from earlier months', summary.earlier],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3 sm:px-5">
            <dt className="text-xs text-slate-600 dark:text-neutral-400">{label}</dt>
            <dd className="mt-1 text-lg tabular-nums font-semibold text-slate-950 dark:text-white">
              {formatRupeesFromPaise(Number(value))}
            </dd>
          </div>
        ))}
      </dl>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center p-1 rounded-xl liquid-glass gap-1 overflow-x-auto">
          {(
            [
              ['collection', 'Monthly Bills'],
              ['reminders', `Who Needs to Pay (${feeReminders.length})`],
              ['discounts', `Discounts (${workspace.discounts.length})`],
              ['history', `Receipts (${workspace.payments.length})`],
            ] as [FeesSubTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                tab === id
                  ? 'bg-sky-600 text-white dark:bg-white dark:text-black'
                  : 'text-slate-600 dark:text-neutral-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'collection' && (
          <div className="flex items-center gap-2">
            <select
              aria-label="Tuition month"
              value={selectedMonth}
              onChange={(e) => setRequestedMonth(e.target.value === defaultMonth ? null : e.target.value)}
              className="px-3 py-2 rounded-xl liquid-glass text-xs font-mono text-slate-900 dark:text-white"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>{getMonthLabel(m)}</option>
              ))}
            </select>
            <select
              aria-label="Filter invoice status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 rounded-xl liquid-glass text-xs text-slate-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="overdue">Overdue</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="waived">Waived</option>
            </select>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl liquid-glass text-xs font-medium text-slate-700 dark:text-neutral-200 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        )}
      </div>

      {tab === 'collection' && (
        <div className="liquid-glass rounded-2xl p-4 sm:p-5 overflow-x-auto">
          {monthInvoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600 dark:text-neutral-400">
              {statusFilter === 'all' ? `No bills for ${getMonthLabel(selectedMonth)}.` : 'No bills match this status.'}
            </p>
          ) : (
            <table className="block sm:table w-full text-left text-sm">
              <thead className="hidden sm:table-header-group">
                <tr className="border-b border-sky-100 dark:border-white/15 text-xs text-slate-600 dark:text-neutral-400">
                  <th className="py-2 pr-3 font-medium">Student</th>
                  <th className="px-2 py-2 font-medium">Due date</th>
                  <th className="px-2 py-2 text-right font-medium">Bill</th>
                  <th className="px-2 py-2 text-right font-medium">Paid</th>
                  <th className="px-2 py-2 text-right font-medium">Outstanding</th>
                  <th className="px-2 py-2 font-medium">Bill status</th>
                  <th className="pl-2 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="block sm:table-row-group divide-y divide-sky-100/80 dark:divide-white/10">
                {monthInvoices.map((inv) => {
                  const student = studentMap.get(inv.studentId);
                  const balance = invoiceBalance(inv);
                  const earlier = earlierBalances.get(inv.studentId) ?? 0;
                  return (
                    <tr key={inv.id} className="grid grid-cols-2 gap-x-3 py-3 sm:table-row">
                      <td className="col-span-2 sm:py-3 sm:pr-3">
                        <div className="font-semibold text-slate-950 dark:text-white"><StudentName student={student} /></div>
                        <p className="text-xs text-slate-600 dark:text-neutral-400">
                          Class {inv.classLevelSnapshot} · {inv.boardSnapshot}
                          {inv.discountSummary ? ` · ${inv.discountSummary}` : ''}
                        </p>
                      </td>
                      <td className="pt-2 sm:p-2 text-xs tabular-nums whitespace-nowrap text-slate-700 dark:text-neutral-300">
                        <span className="block sm:hidden text-slate-500 dark:text-neutral-400">Due date</span>
                        {inv.dueDate}
                      </td>
                      <td className="pt-2 sm:p-2 sm:text-right tabular-nums">
                        <span className="block sm:hidden text-xs text-slate-500 dark:text-neutral-400">Bill</span>
                        {formatRupeesFromPaise(inv.totalAmountPaise)}
                      </td>
                      <td className="pt-2 sm:p-2 sm:text-right tabular-nums">
                        <span className="block sm:hidden text-xs text-slate-500 dark:text-neutral-400">Paid</span>
                        {formatRupeesFromPaise(inv.paidAmountPaise)}
                      </td>
                      <td className="pt-2 sm:p-2 sm:text-right tabular-nums">
                        <span className="block sm:hidden text-xs text-slate-500 dark:text-neutral-400">Outstanding</span>
                        <span className="font-semibold">{formatRupeesFromPaise(balance + earlier)}</span>
                        {earlier > 0 && (
                          <span className="block text-xs text-slate-600 dark:text-neutral-400">
                            {formatRupeesFromPaise(balance)} this month · {formatRupeesFromPaise(earlier)} earlier
                          </span>
                        )}
                      </td>
                      <td className="self-center pt-2 sm:p-2 text-xs font-medium capitalize">
                        <span className={inv.status === 'overdue' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-600 dark:text-neutral-300'}>{inv.status}</span>
                      </td>
                      <td className="pt-2 sm:pl-2 sm:py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {balance + earlier > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentModalInvoiceId(earlier > 0 ? null : inv.id);
                                setPaymentThroughMonth(selectedMonth);
                                setPaymentModalStudentId(inv.studentId);
                              }}
                              className="min-h-10 px-2.5 rounded-lg text-xs font-semibold bg-sky-600 dark:bg-white text-white dark:text-black"
                            >
                              Collect
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingInvoiceId(inv.id)}
                            aria-label={`Edit bill for ${student?.fullName ?? 'student'}`}
                            className="min-h-10 inline-flex items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 dark:text-neutral-200 hover:bg-sky-50 dark:hover:bg-white/10"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: WHO NEEDS TO PAY REMINDERS */}
      {tab === 'reminders' && (
        <div className="space-y-3">
          {feeReminders.length === 0 ? (
            <div className="liquid-glass rounded-3xl p-8 text-center text-sm text-slate-600 dark:text-neutral-400">
              No due or overdue invoices to follow up today.
            </div>
          ) : (
            feeReminders.map((rem) => (
              <div key={rem.dedupKey} className="liquid-glass rounded-3xl p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white">
                      <StudentName student={studentMap.get(rem.studentId)} /> <span className="font-mono">{formatRupeesFromPaise(rem.balancePaise)}</span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-neutral-400">
                      {rem.reason} · Due {rem.dueDate}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyMessage(rem.dedupKey, rem.suggestedMessage)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-sky-200 dark:border-white/20 text-slate-800 dark:text-white"
                    >
                      {copiedId === rem.dedupKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === rem.dedupKey ? 'Copied' : 'Copy Message'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentModalInvoiceId(rem.invoiceId);
                        setPaymentThroughMonth(null);
                        setPaymentModalStudentId(rem.studentId);
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 dark:bg-white text-white dark:text-black"
                    >
                      Record Paid
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-neutral-400 bg-sky-50/70 dark:bg-neutral-900 rounded-xl p-3">
                  “{rem.suggestedMessage}”
                </p>
              </div>
            ))
          )}
          <p className="text-[11px] text-slate-500 dark:text-neutral-500">
            Note: WhatsApp sharing opens your device’s WhatsApp app with a prefilled polite message for manual one-tap sending (free, requires no paid WhatsApp Business API).
          </p>
        </div>
      )}

      {/* TAB 3: DISCOUNTS */}
      {tab === 'discounts' && (
        <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950 dark:text-white">Active Discount Rules</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Supports fixed-rupee or percentage discounts across individual students, classes, boards, or globally — with optional expiry dates
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDiscountModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 dark:bg-white text-white dark:text-black"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Discount</span>
            </button>
          </div>

          <div className="divide-y divide-sky-100/80 dark:divide-white/10">
            {workspace.discounts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-neutral-400 py-4">No discount rules configured.</p>
            ) : (
              workspace.discounts.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Percent className="w-3.5 h-3.5 text-sky-600 dark:text-white" />
                      {d.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-neutral-400">
                      {d.kind === 'percentage' ? `${d.value}% off` : `${formatRupeesFromPaise(d.value)} off`} · Scope: {d.scope}
                      {d.studentId ? ` (${studentMap.get(d.studentId)?.fullName ?? ''})` : ''}
                      {d.classLevel ? ` (Class ${d.classLevel})` : ''}
                      {d.board ? ` (${d.board})` : ''}
                      {d.endDate ? ` · Valid until ${d.endDate}` : ' · Permanent'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteDiscount(d.id)}
                    aria-label={`Delete discount ${d.name}`}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: RECEIPTS & TRANSACTION HISTORY */}
      {tab === 'history' && (
        <div className="liquid-glass rounded-3xl p-5 sm:p-6 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-sky-100 dark:border-white/15 text-xs text-slate-500 dark:text-neutral-400">
                <th className="py-2 pr-4 font-medium">Receipt #</th>
                <th className="py-2 px-3 font-medium">Student</th>
                <th className="py-2 px-3 font-medium">Date & Method</th>
                <th className="py-2 px-3 text-right font-medium">Amount</th>
                <th className="py-2 pl-3 text-right font-medium">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70 dark:divide-white/10">
              {workspace.payments.map((p) => {
                const stu = studentMap.get(p.studentId);
                return (
                  <tr key={p.id}>
                    <td className="py-3 pr-4 font-mono text-xs font-semibold text-slate-900 dark:text-white">{p.receiptNumber}</td>
                    <td className="py-3 px-3 text-xs font-medium text-slate-800 dark:text-neutral-200"><StudentName student={stu} /></td>
                    <td className="py-3 px-3 text-xs text-slate-500 dark:text-neutral-400 font-mono">
                      {p.paymentDate} · {p.method.toUpperCase()} {p.transactionRef ? `· ${p.transactionRef}` : ''}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-xs font-bold text-slate-950 dark:text-white">
                      {formatRupeesFromPaise(p.amountPaise)}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => setReceiptPayment(p)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-white hover:underline"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>View / Print</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {paymentModalStudentId && (
        <RecordPaymentModal
          workspace={workspace}
          studentId={paymentModalStudentId}
          invoiceId={paymentModalInvoiceId}
          throughMonth={paymentThroughMonth ?? selectedMonth}
          onClose={() => {
            setPaymentModalStudentId(null);
            setPaymentModalInvoiceId(null);
            onClearInitialPaymentStudent();
          }}
          onSubmit={async (payload) => {
            await onRecordPayment(payload);
            setPaymentModalStudentId(null);
            setPaymentModalInvoiceId(null);
            onClearInitialPaymentStudent();
          }}
        />
      )}

      {editingInvoice && (
        <EditBillModal
          invoice={editingInvoice}
          student={studentMap.get(editingInvoice.studentId)}
          currentMonth={workspace.currentMonthIst}
          defaultDueDay={workspace.settings.feeConfig.defaultDueDay}
          onClose={() => setEditingInvoiceId(null)}
          onSave={async (patch) => {
            await onEditInvoice(editingInvoice.id, patch);
            setEditingInvoiceId(null);
          }}
        />
      )}

      {/* ADD DISCOUNT MODAL */}
      {showDiscountModal && (
        <AddDiscountModal
          workspace={workspace}
          onClose={() => setShowDiscountModal(false)}
          onSubmit={async (payload) => {
            await onCreateDiscount(payload);
            setShowDiscountModal(false);
          }}
        />
      )}

      {/* PRINTABLE RECEIPT MODAL */}
      {receiptPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Fee Payment Receipt"
        >
          <div className="bg-white dark:bg-neutral-950 border border-sky-200 dark:border-white/20 w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-white/15 pb-4">
              <div>
                <p className="font-display font-bold text-lg text-slate-950 dark:text-white">
                  {workspace.settings.tuitionName}
                </p>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  {workspace.settings.teacherName} · {workspace.settings.contactPhone}
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-sky-700 dark:text-white">
                {receiptPayment.receiptNumber}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Student</span>
                <span className="font-semibold text-slate-950 dark:text-white">
                  <StudentName student={studentMap.get(receiptPayment.studentId)} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Class & Board</span>
                <span className="text-slate-800 dark:text-neutral-200">
                  Class {studentMap.get(receiptPayment.studentId)?.classLevel} · {studentMap.get(receiptPayment.studentId)?.board}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Payment Date</span>
                <span className="font-mono text-slate-800 dark:text-neutral-200">{receiptPayment.paymentDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-neutral-400">Method & Reference</span>
                <span className="font-mono text-slate-800 dark:text-neutral-200 uppercase">
                  {receiptPayment.method} {receiptPayment.transactionRef ? `(${receiptPayment.transactionRef})` : ''}
                </span>
              </div>
              <div className="flex justify-between pt-3 mt-2 border-t border-slate-200 dark:border-white/15 text-base font-bold">
                <span className="text-slate-900 dark:text-white">Amount Received</span>
                <span className="font-mono tabular-nums text-slate-950 dark:text-white">
                  {formatRupeesFromPaise(receiptPayment.amountPaise)}
                </span>
              </div>
              {receiptPayment.allocations && (
                <dl className="space-y-1 pt-2 text-slate-700 dark:text-neutral-300">
                  {receiptPayment.allocations.map((line) => (
                    <div key={line.monthKey} className="flex justify-between gap-3">
                      <dt>{getMonthLabel(line.monthKey)} bill</dt><dd>{formatRupeesFromPaise(line.amountPaise)}</dd>
                    </div>
                  ))}
                  {receiptPayment.isAdvance && (
                    <div className="flex justify-between gap-3">
                      <dt>Advance credit</dt>
                      <dd>{formatRupeesFromPaise(receiptPayment.amountPaise - receiptPayment.allocations.reduce((sum, line) => sum + line.amountPaise, 0))}</dd>
                    </div>
                  )}
                </dl>
              )}
              {receiptPayment.notes && (
                <p className="text-xs text-slate-500 dark:text-neutral-400 pt-1">Note: {receiptPayment.notes}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 no-print">
              <button
                type="button"
                onClick={() => setReceiptPayment(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-white/20"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 dark:bg-white text-white dark:text-black"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EditBillModal: React.FC<{
  invoice: FeeInvoice;
  student?: Student;
  currentMonth: string;
  defaultDueDay: number;
  onClose: () => void;
  onSave: (patch: InvoiceEdit) => Promise<void>;
}> = ({ invoice, student, currentMonth, defaultDueDay, onClose, onSave }) => {
  const [original] = useState(invoice);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [waived, setWaived] = useState(invoice.status === 'waived');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dueMonth = invoice.dueDate.slice(0, 7);
  const nextMonth = nextMonthKey(dueMonth > currentMonth ? dueMonth : currentMonth);
  const nextDueDate = buildDueDateForMonth(nextMonth, student?.feeDueDay ?? defaultDueDay);
  const patch: InvoiceEdit = {};
  if (dueDate !== original.dueDate) patch.dueDate = dueDate;
  if (waived !== (original.status === 'waived')) patch.waived = waived;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-bill-title">
      <form
        className="bg-white dark:bg-neutral-950 border border-sky-100 dark:border-white/15 w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl p-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving || !dueDate || Object.keys(patch).length === 0) return;
          setSaving(true);
          setError('');
          try {
            await onSave(patch);
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Could not save the bill.');
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="edit-bill-title" className="text-lg font-semibold text-slate-950 dark:text-white">Edit {getMonthLabel(invoice.monthKey)} bill</h2>
            <p className="text-sm text-slate-700 dark:text-neutral-300"><StudentName student={student} /></p>
          </div>
          <button type="button" aria-label="Close bill editor" onClick={onClose} className="p-2 rounded-lg hover:bg-sky-50 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
        <p className="text-sm text-slate-700 dark:text-neutral-300">
          {formatRupeesFromPaise(invoice.paidAmountPaise)} paid · {formatRupeesFromPaise(Math.max(0, invoice.totalAmountPaise - invoice.paidAmountPaise))} {waived ? 'waived' : 'remaining'}
        </p>
        <div>
          <label htmlFor="bill-due-date" className="block text-sm font-medium">Due date</label>
          <input
            id="bill-due-date"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
            className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 dark:border-white/20 bg-white dark:bg-black px-3 text-sm"
          />
          <button type="button" className="min-h-10 text-sm font-medium text-sky-700 dark:text-sky-300" onClick={() => setDueDate(nextDueDate)}>
            Collect in {getMonthLabel(nextMonth)}
          </button>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={waived} onChange={(event) => setWaived(event.target.checked)} />
          <span>Waive remaining balance</span>
        </label>
        <div className="flex justify-end gap-2 border-t border-sky-100 dark:border-white/15 pt-3">
          <button type="button" className="min-h-11 px-4 text-sm" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving || !dueDate || Object.keys(patch).length === 0}
            className="min-h-11 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Save bill'}
          </button>
        </div>
      </form>
    </div>
  );
};

const RecordPaymentModal: React.FC<{
  workspace: WorkspaceSnapshot;
  studentId: string;
  invoiceId: string | null;
  throughMonth: string;
  onClose: () => void;
  onSubmit: (payload: {
    studentId: string;
    invoiceId?: string | null;
    throughMonth?: string;
    amountPaise: number;
    method: PaymentMethod;
    transactionRef: string;
    notes: string;
    idempotencyKey: string;
  }) => Promise<void>;
}> = ({ workspace, studentId: initialStudent, invoiceId, throughMonth, onClose, onSubmit }) => {
  const eligibleBills = (studentId: string) => workspace.invoices.filter((invoice) =>
    invoice.studentId === studentId && invoice.monthKey <= throughMonth && invoiceBalance(invoice) > 0,
  ).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const suggestAmount = (studentId: string, target: string | null) => {
    const bills = eligibleBills(studentId).filter((invoice) => target === null || invoice.id === target);
    const balance = bills.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
    return balance > 0 ? String(balance / 100) : '';
  };
  const [sid, setSid] = useState(initialStudent);
  const [targetId, setTargetId] = useState(invoiceId);
  const [rupees, setRupees] = useState(() => suggestAmount(initialStudent, invoiceId));
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [txRef, setTxRef] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const bills = eligibleBills(sid);
  const amountPaise = Math.round(Number(rupees) * 100);
  const preview = allocatePaymentToInvoices({
    invoices: bills, paymentAmountPaise: Number.isFinite(amountPaise) ? amountPaise : 0,
    todayDate: workspace.todayIst, targetInvoiceId: targetId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        studentId: sid, invoiceId: targetId, throughMonth, amountPaise, method,
        transactionRef: txRef.trim(), notes: notes.trim(), idempotencyKey,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not record the payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Record Fee Payment"
    >
      <form onSubmit={handleSubmit} className="liquid-glass-strong flex flex-col w-full max-w-md max-h-[90dvh] overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Record payment</h2>
          <button type="button" onClick={onClose} aria-label="Close payment modal"><X className="w-4 h-4" /></button>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
          <div>
            <label htmlFor="pay-student" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Student</label>
            <select
              id="pay-student"
              value={sid}
              onChange={(e) => {
                setSid(e.target.value);
                setTargetId(null);
                setRupees(suggestAmount(e.target.value, null));
              }}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
            >
              {workspace.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nickname ? `${s.nickname} (${s.fullName})` : s.fullName} (Class {s.classLevel} {s.board})
                </option>
              ))}
            </select>
          </div>

          {bills.length > 0 && (
            <div>
              <label htmlFor="pay-scope" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Apply payment to</label>
              <select
                id="pay-scope"
                value={targetId ?? ''}
                onChange={(e) => {
                  const target = e.target.value || null;
                  setTargetId(target);
                  setRupees(suggestAmount(sid, target));
                }}
                className="w-full min-h-11 px-3 rounded-xl bg-white dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
              >
                <option value="">Outstanding bills, oldest first</option>
                {bills.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>{getMonthLabel(invoice.monthKey)} first · {formatRupeesFromPaise(invoiceBalance(invoice))} due</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pay-amount" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">
                Amount (₹) *
              </label>
              <input
                id="pay-amount"
                type="number"
                min={0.01}
                step="0.01"
                required
                value={rupees}
                onChange={(e) => setRupees(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="pay-method" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Method</label>
              <select
                id="pay-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
              >
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {(preview.allocations.length > 0 || preview.remainingAdvanceCreditPaise > 0) && (
            <dl className="rounded-xl border border-sky-100 dark:border-white/15 p-3 space-y-1.5 text-xs">
              {preview.allocations.map((line) => {
                const bill = bills.find((invoice) => invoice.id === line.invoiceId)!;
                return (
                  <div key={line.invoiceId} className="flex items-start justify-between gap-3">
                    <dt>{getMonthLabel(bill.monthKey)} bill</dt>
                    <dd className="text-right">
                      {formatRupeesFromPaise(line.appliedPaise)}
                      <span className="block text-slate-600 dark:text-neutral-400">
                        {formatRupeesFromPaise(bill.totalAmountPaise - line.newPaidPaise)} remaining
                      </span>
                    </dd>
                  </div>
                );
              })}
              {preview.remainingAdvanceCreditPaise > 0 && (
                <div className="flex justify-between gap-3">
                  <dt>Advance credit</dt><dd>{formatRupeesFromPaise(preview.remainingAdvanceCreditPaise)}</dd>
                </div>
              )}
            </dl>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">
              Transaction Reference (optional)
            </label>
            <input
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
              maxLength={80}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={300}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-sky-100 dark:border-white/15 px-5 py-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs border border-sky-200 dark:border-white/20">Cancel</button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-600 dark:bg-white text-white dark:text-black"
          >
            {saving ? 'Recording...' : 'Save payment'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AddDiscountModal: React.FC<{
  workspace: WorkspaceSnapshot;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}> = ({ workspace, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<DiscountKind>('fixed');
  const [val, setVal] = useState('100');
  const [scope, setScope] = useState<DiscountScope>('student');
  const [studentId, setStudentId] = useState(workspace.students[0]?.id ?? '');
  const [classLevel, setClassLevel] = useState<ClassLevel>(7);
  const [board, setBoard] = useState<BoardType>('CBSE');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(val);
    if (!name.trim() || !Number.isFinite(num) || num <= 0) return;
    await onSubmit({
      name: name.trim(),
      kind,
      value: kind === 'fixed' ? Math.round(num * 100) : Math.min(100, Math.round(num)),
      scope,
      studentId: scope === 'student' ? studentId : undefined,
      classLevel: scope === 'class' ? classLevel : undefined,
      board: scope === 'board' ? board : undefined,
      endDate: endDate || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add Fee Discount"
    >
      <form onSubmit={handleSubmit} className="liquid-glass-strong w-full max-w-md rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Create Discount Rule</h2>
          <button type="button" onClick={onClose} aria-label="Close discount modal"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Discount Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sibling Discount / Merit Award"
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Type</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as DiscountKind)}
                className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
              >
                <option value="fixed">Fixed (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">
                {kind === 'fixed' ? 'Amount (₹)' : 'Percent (%)'}
              </label>
              <input
                type="number"
                min={1}
                max={kind === 'percentage' ? 100 : 10000}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Applies To</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as DiscountScope)}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
            >
              <option value="student">Specific Student</option>
              <option value="class">Specific Class</option>
              <option value="board">Specific Board</option>
              <option value="global">All Students</option>
            </select>
          </div>
          {scope === 'student' && (
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
            >
              {workspace.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nickname ? `${s.nickname} (${s.fullName})` : s.fullName}
                </option>
              ))}
            </select>
          )}
          {scope === 'class' && (
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(Number(e.target.value) as ClassLevel)}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          )}
          {scope === 'board' && (
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value as BoardType)}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
            >
              <option value="SSC">SSC</option>
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
            </select>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">
              Expiry Date (leave blank for permanent)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs border border-sky-200 dark:border-white/20">Cancel</button>
          <button type="submit" className="px-5 py-2 rounded-xl text-xs font-semibold bg-sky-600 dark:bg-white text-white dark:text-black">Save Discount</button>
        </div>
      </form>
    </div>
  );
};
