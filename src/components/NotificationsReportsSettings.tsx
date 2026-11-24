import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Download,
  Info,
  Printer,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { BoardType, ClassLevel, TuitionSettings, WorkspaceSnapshot } from '../types';
import type { ThemePreference } from '../hooks/useTheme';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { DEFAULT_FEE_CONFIG } from '../engines/feeEngine';
import { formatRupeesFromPaise } from '../engines/istDate';
import { apiRequest, downloadCsv } from '../lib/api';

// --- NOTIFICATIONS VIEW ---

export const NotificationsView: React.FC<{
  workspace: WorkspaceSnapshot;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}> = ({ workspace, onMarkRead, onMarkAllRead }) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const pushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const [permission, setPermission] = useState<NotificationPermission>(() => pushSupported ? Notification.permission : 'default');
  const [device, setDevice] = useState<{ registration: ServiceWorkerRegistration; publicKey: string } | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [changingSubscription, setChangingSubscription] = useState(false);
  const [pushError, setPushError] = useState('');

  const items = useMemo(
    () => workspace.notifications.filter((n) => (filter === 'unread' ? !n.read : true)),
    [workspace.notifications, filter],
  );

  useEffect(() => {
    if (!pushSupported || permission === 'denied') return;
    let active = true;
    void Promise.all([
      navigator.serviceWorker.ready,
      apiRequest<{ publicKey: string }>('/api/notifications/push'),
    ]).then(async ([registration, { publicKey }]) => {
      const subscription = await registration.pushManager.getSubscription();
      if (active) {
        setDevice({ registration, publicKey });
        setSubscribed(permission === 'granted' && subscription !== null);
      }
    }).catch(() => {
      if (active) setPushError('Device notifications could not load. Reopen Alerts to retry.');
    });
    return () => { active = false; };
  }, [pushSupported, permission]);

  const toggleDeviceNotifications = async () => {
    if (!device || changingSubscription) return;
    setChangingSubscription(true);
    setPushError('');
    let pendingSubscription: PushSubscription | undefined;
    try {
      const manager = device.registration.pushManager;
      if (subscribed) {
        const subscription = await manager.getSubscription();
        if (subscription) {
          await apiRequest('/api/notifications/push', { method: 'DELETE', body: { endpoint: subscription.endpoint } });
          await subscription.unsubscribe();
        }
        setSubscribed(false);
      } else {
        pendingSubscription = await manager.subscribe({ userVisibleOnly: true, applicationServerKey: device.publicKey });
        await apiRequest('/api/notifications/push', { method: 'POST', body: pendingSubscription.toJSON() });
        setSubscribed(true);
      }
    } catch (error) {
      if (pendingSubscription) await pendingSubscription.unsubscribe().catch(() => {});
      setPushError(Notification.permission === 'denied'
        ? 'Allow notifications in your browser settings to enable fee reminders.'
        : error instanceof Error ? error.message : 'Device notifications could not be updated.');
    } finally {
      setPermission(Notification.permission);
      setChangingSubscription(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Notifications & Reminders</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Fee reminders arrive here one day before payment is due.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleDeviceNotifications}
            disabled={!device || changingSubscription || permission === 'denied'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-sky-200 dark:border-white/20 bg-white/80 dark:bg-neutral-950 text-slate-800 dark:text-white disabled:opacity-60"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>
              {changingSubscription ? 'Saving…' : subscribed ? 'Turn off device alerts' : 'Enable device alerts'}
            </span>
          </button>
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold glass-primary text-white"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark All Read</span>
          </button>
        </div>
      </div>

      {pushError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{pushError}</p>}
      {permission === 'denied' && !pushError && (
        <p className="text-sm text-slate-600 dark:text-neutral-300">Notifications are blocked in this browser’s settings.</p>
      )}

      <div className="flex items-center p-1 rounded-xl liquid-glass gap-1 w-fit">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            filter === 'all' ? 'glass-primary text-white' : 'text-slate-600 dark:text-neutral-400'
          }`}
        >
          All ({workspace.notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            filter === 'unread' ? 'glass-primary text-white' : 'text-slate-600 dark:text-neutral-400'
          }`}
        >
          Unread ({workspace.notifications.filter((n) => !n.read).length})
        </button>
      </div>

      <div className="liquid-glass rounded-3xl p-5 divide-y divide-sky-100/80 dark:divide-white/10">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-neutral-400 py-6 text-center">No notifications to display.</p>
        ) : (
          items.map((n) => (
            <div key={n.id} className="py-3.5 first:pt-1 last:pb-1 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className={`text-sm ${n.read ? 'font-medium text-slate-700 dark:text-neutral-400' : 'font-bold text-slate-950 dark:text-white'}`}>
                  {n.title}
                </p>
                <p className="text-xs text-slate-600 dark:text-neutral-400">{n.message}</p>
                <p className="text-[11px] font-mono text-slate-400 dark:text-neutral-500">
                  {n.category.replace(/_/g, ' ')} {n.scheduledFor ? `· ${n.scheduledFor}` : ''}
                </p>
              </div>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => onMarkRead(n.id)}
                  className="text-xs font-semibold text-sky-700 dark:text-white hover:underline shrink-0"
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="liquid-glass rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600 dark:text-neutral-400">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-white" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-neutral-200">
            Fee alerts on this device
          </p>
          <p>
            Enable alerts on each device you use. On iPhone or iPad, add Tuitio to your Home Screen and open it from there to enable alerts.
          </p>
        </div>
      </div>
    </div>
  );
};

// --- REPORTS & ANALYTICS VIEW ---

export const ReportsView: React.FC<{ workspace: WorkspaceSnapshot }> = ({ workspace }) => {
  const activeStudents = useMemo(
    () => workspace.students.filter((s) => s.status === 'active'),
    [workspace.students],
  );

  // Real Financial Analytics
  const financial = useMemo(() => {
    const curInvs = workspace.invoices.filter((i) => i.monthKey === workspace.currentMonthIst && i.status !== 'waived');
    const expected = curInvs.reduce((s, i) => s + i.totalAmountPaise, 0);
    const collected = curInvs.reduce((s, i) => s + i.paidAmountPaise, 0);
    const byBoard: Record<BoardType, { expected: number; collected: number }> = {
      SSC: { expected: 0, collected: 0 },
      CBSE: { expected: 0, collected: 0 },
      ICSE: { expected: 0, collected: 0 },
    };
    const byClass = new Map<number, { expected: number; collected: number }>();

    for (const inv of curInvs) {
      byBoard[inv.boardSnapshot].expected += inv.totalAmountPaise;
      byBoard[inv.boardSnapshot].collected += inv.paidAmountPaise;
      const cur = byClass.get(inv.classLevelSnapshot) ?? { expected: 0, collected: 0 };
      cur.expected += inv.totalAmountPaise;
      cur.collected += inv.paidAmountPaise;
      byClass.set(inv.classLevelSnapshot, cur);
    }

    return {
      expected,
      collected,
      outstanding: Math.max(0, expected - collected),
      rate: expected > 0 ? Math.round((collected / expected) * 100) : 100,
      byBoard,
      byClass: Array.from(byClass.entries()).sort((a, b) => a[0] - b[0]),
    };
  }, [workspace.invoices, workspace.currentMonthIst]);

  // Real Academic & Attendance Analytics
  const academic = useMemo(() => {
    const totalHw = workspace.homework.length;
    const completedHw = workspace.homework.filter((h) => h.status === 'completed' || h.status === 'verified').length;
    const gradedExams = workspace.exams.filter((e) => e.obtainedMarks != null && e.maxMarks > 0);
    const avgScore =
      gradedExams.length > 0
        ? Math.round(gradedExams.reduce((s, e) => s + ((e.obtainedMarks ?? 0) / e.maxMarks) * 100, 0) / gradedExams.length)
        : null;

    const subjectCount = new Map<string, number>();
    for (const h of workspace.homework) {
      subjectCount.set(h.subject, (subjectCount.get(h.subject) ?? 0) + 1);
    }
    const demandingSubjects = Array.from(subjectCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);

    const markedAtt = workspace.attendance.filter((a) => a.status !== 'unmarked');
    const presentAtt = markedAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
    const attRate = markedAtt.length > 0 ? Math.round((presentAtt / markedAtt.length) * 100) : 100;

    return {
      hwRate: totalHw > 0 ? Math.round((completedHw / totalHw) * 100) : 100,
      completedHw,
      totalHw,
      avgScore,
      attRate,
      demandingSubjects,
    };
  }, [workspace.homework, workspace.exams, workspace.attendance]);

  const exportFullReportCsv = () => {
    downloadCsv(
      `tuitio-analytics-${workspace.todayIst}.csv`,
      ['Student', 'Class', 'Board', 'Performance %', 'Pending HW', 'Attendance Present', 'Attendance Absent'],
      activeStudents.map((s) => {
        const hwPending = workspace.homework.filter((h) => h.studentId === s.id && h.status !== 'completed' && h.status !== 'verified').length;
        const attP = workspace.attendance.filter((a) => a.studentId === s.id && (a.status === 'present' || a.status === 'late')).length;
        const attA = workspace.attendance.filter((a) => a.studentId === s.id && a.status === 'absent').length;
        return [s.fullName, `Class ${s.classLevel}`, s.board, s.academicPerformance, hwPending, attP, attA];
      }),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Reports & Analytics</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Computed live from stored attendance, homework, exam, and fee records — zero hardcoded numbers
          </p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={exportFullReportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-sky-200 dark:border-white/20 bg-white/80 dark:bg-neutral-950 text-slate-800 dark:text-white"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold glass-primary text-white"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="liquid-glass rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-neutral-400">Fee Collection Rate</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-950 dark:text-white mt-1">{financial.rate}%</p>
          <p className="text-xs font-mono text-slate-500 dark:text-neutral-400 mt-0.5">
            {formatRupeesFromPaise(financial.collected)} / {formatRupeesFromPaise(financial.expected)}
          </p>
        </div>
        <div className="liquid-glass rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-neutral-400">Attendance Rate</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-950 dark:text-white mt-1">{academic.attRate}%</p>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{activeStudents.length} active students</p>
        </div>
        <div className="liquid-glass rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-neutral-400">Homework Completion</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-950 dark:text-white mt-1">{academic.hwRate}%</p>
          <p className="text-xs font-mono text-slate-500 dark:text-neutral-400 mt-0.5">
            {academic.completedHw}/{academic.totalHw} tasks verified
          </p>
        </div>
        <div className="liquid-glass rounded-2xl p-4 sm:p-5">
          <p className="text-xs text-slate-500 dark:text-neutral-400">Average Exam Score</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-950 dark:text-white mt-1">
            {academic.avgScore != null ? `${academic.avgScore}%` : '—'}
          </p>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Graded tests</p>
        </div>
      </div>

      {/* Board-wise & Class-wise Collections */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-950 dark:text-white">Board-Wise Collections ({workspace.currentMonthIst})</h2>
          <div className="space-y-3">
            {(['SSC', 'CBSE', 'ICSE'] as BoardType[]).map((b) => {
              const row = financial.byBoard[b];
              const pct = row.expected > 0 ? Math.round((row.collected / row.expected) * 100) : 0;
              return (
                <div key={b} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono tabular-nums">
                    <span className="font-sans font-semibold text-slate-800 dark:text-white">{b}</span>
                    <span className="text-slate-600 dark:text-neutral-300">
                      {formatRupeesFromPaise(row.collected)} / {formatRupeesFromPaise(row.expected)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-sky-100 dark:bg-neutral-900 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-600 dark:bg-white transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-950 dark:text-white">Most Demanding Subjects & Class Revenue</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <p className="font-semibold text-slate-600 dark:text-neutral-400">Homework Load by Subject</p>
              {academic.demandingSubjects.map(([sub, cnt]) => (
                <div key={sub} className="flex justify-between py-1 border-b border-sky-100/70 dark:border-white/10">
                  <span className="text-slate-800 dark:text-neutral-200">{sub}</span>
                  <span className="font-mono font-semibold text-slate-950 dark:text-white">{cnt} tasks</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-slate-600 dark:text-neutral-400">Class-Wise Billing</p>
              {financial.byClass.map(([cls, data]) => (
                <div key={cls} className="flex justify-between py-1 border-b border-sky-100/70 dark:border-white/10 font-mono tabular-nums">
                  <span className="font-sans text-slate-800 dark:text-neutral-200">Class {cls}</span>
                  <span className="text-slate-950 dark:text-white">{formatRupeesFromPaise(data.expected)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

// --- SETTINGS VIEW ---

export const SettingsView: React.FC<{
  workspace: WorkspaceSnapshot;
  theme: ThemePreference;
  onChangeTheme: (t: ThemePreference) => void;
  onSaveSettings: (next: TuitionSettings) => Promise<void>;
  onSeedDemo: () => Promise<void>;
  onClearDemo: () => Promise<void>;
  onRestoreBackup: (json: unknown) => Promise<void>;
}> = ({
  workspace,
  theme,
  onChangeTheme,
  onSaveSettings,
  onSeedDemo,
  onClearDemo,
  onRestoreBackup,
}) => {
  const [draft, setDraft] = useState<TuitionSettings>(() => structuredClone(workspace.settings));
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const updateClassRateRupees = (cls: ClassLevel, rupeesStr: string) => {
    const num = Math.max(0, Math.round((Number(rupeesStr) || 0) * 100));
    setDraft((prev) => ({
      ...prev,
      feeConfig: {
        ...prev.feeConfig,
        classRatesPaise: { ...prev.feeConfig.classRatesPaise, [cls]: num },
      },
    }));
  };

  const updateBoardSurchargeRupees = (board: BoardType, rupeesStr: string) => {
    const num = Math.max(0, Math.round((Number(rupeesStr) || 0) * 100));
    setDraft((prev) => ({
      ...prev,
      feeConfig: {
        ...prev.feeConfig,
        boardSurchargesPaise: { ...prev.feeConfig.boardSurchargesPaise, [board]: num },
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSettingsError('');
    setSaving(true);
    try {
      await onSaveSettings(draft);
      setSavedBanner('Settings saved and synchronized.');
      setTimeout(() => setSavedBanner(null), 3000);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setSettingsError('');
    setSavedBanner(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await onRestoreBackup(parsed);
      setSavedBanner('Backup restored successfully.');
    } catch (error) {
      setSettingsError(error instanceof SyntaxError ? 'Choose a valid JSON file.' :
        error instanceof Error ? error.message : 'Unable to restore the backup.');
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Settings & Customization</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Configure tuition name, 6:00–8:00 PM schedule, editable fee matrix, reminders, theme, PWA install, and backups
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold glass-primary text-white self-start"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
        </button>
      </div>

      {savedBanner && (
        <div className="liquid-glass rounded-2xl px-4 py-3 text-xs font-medium text-emerald-800 dark:text-white flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{savedBanner}</span>
        </div>
      )}
      {settingsError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{settingsError}</p>}

      {/* 1. Tuition Profile & Timings */}
      <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">Tuition Identity & Daily Timings (IST)</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Tuition Name</label>
            <input
              value={draft.tuitionName}
              onChange={(e) => setDraft({ ...draft, tuitionName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Teacher Name</label>
            <input
              value={draft.teacherName}
              onChange={(e) => setDraft({ ...draft, teacherName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Contact Phone</label>
            <input
              value={draft.contactPhone}
              onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Session Start (IST)</label>
            <input
              type="time"
              value={draft.sessionStart}
              onChange={(e) => setDraft({ ...draft, sessionStart: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Session End (IST)</label>
            <input
              type="time"
              value={draft.sessionEnd}
              onChange={(e) => setDraft({ ...draft, sessionEnd: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Academic Year</label>
            <input
              value={draft.academicYear}
              onChange={(e) => setDraft({ ...draft, academicYear: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </section>

      {/* 2. Editable Class-Wise & Board Surcharge Fee Matrix */}
      <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-950 dark:text-white">Editable Monthly Fee Structure (₹)</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              Changes update future monthly billing and promotion previews without altering historical invoices
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, feeConfig: structuredClone(DEFAULT_FEE_CONFIG) })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-white hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Default Matrix</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([3, 4, 5, 6, 7, 8, 9, 10] as ClassLevel[]).map((cls) => (
            <div key={cls}>
              <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">
                Class {cls} SSC Base (₹)
              </label>
              <input
                type="number"
                min={0}
                value={draft.feeConfig.classRatesPaise[cls] / 100}
                onChange={(e) => updateClassRateRupees(cls, e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-3 pt-2 border-t border-sky-100 dark:border-white/15">
          {(['SSC', 'CBSE', 'ICSE'] as BoardType[]).map((b) => (
            <div key={b}>
              <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">
                {b} Board Surcharge (+₹)
              </label>
              <input
                type="number"
                min={0}
                value={draft.feeConfig.boardSurchargesPaise[b] / 100}
                onChange={(e) => updateBoardSurchargeRupees(b, e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-neutral-300 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.feeConfig.prorateFirstMonth}
            onChange={(e) =>
              setDraft({ ...draft, feeConfig: { ...draft.feeConfig, prorateFirstMonth: e.target.checked } })
            }
          />
          <span>Automatically prorate first-month fees for mid-month admissions</span>
        </label>
      </section>

      {/* 3. Theme, PWA Installation & Reminders */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-950 dark:text-white">Appearance & App Installation</h2>
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-700 dark:text-neutral-300">Theme Mode</span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['light', 'Light Blue Glass'],
                  ['dark', 'Monochrome Dark'],
                  ['system', 'System'],
                ] as [ThemePreference, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onChangeTheme(id);
                    setDraft({ ...draft, theme: id });
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-colors ${
                    theme === id
                      ? 'glass-primary text-white border-sky-600 dark:border-white'
                      : 'bg-white/70 dark:bg-black border-sky-200 dark:border-white/15 text-slate-700 dark:text-neutral-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-sky-100 dark:border-white/15 space-y-2">
            <p className="text-xs font-semibold text-slate-800 dark:text-neutral-200">Install Tuitio PWA on Phone / Desktop</p>
            {isInstalled ? (
              <p className="text-xs text-emerald-700 dark:text-neutral-300">Tuitio is running in installed standalone app mode.</p>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold glass-primary text-white"
              >
                <Smartphone className="w-4 h-4" />
                <span>Install Tuitio App</span>
              </button>
            ) : isIOS ? (
              <button
                type="button"
                onClick={() => setShowIOSGuide((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-sky-200 dark:border-white/20 text-slate-800 dark:text-white"
              >
                <Smartphone className="w-4 h-4" />
                <span>How to Install on iPhone / iPad</span>
              </button>
            ) : (
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Use your browser’s address-bar Install icon or “Add to Home Screen” to install Tuitio offline.
              </p>
            )}
            {showIOSGuide && (
              <p className="text-xs text-slate-600 dark:text-neutral-300 p-3 rounded-xl bg-sky-50/70 dark:bg-neutral-900">
                1. Tap the <strong>Share</strong> icon in Safari. 2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
            )}
          </div>
        </section>

        <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-950 dark:text-white">Reminder Schedule & Message Template</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-neutral-400 mb-1">Daily Prep Alert</label>
              <input
                type="time"
                value={draft.reminders.dailyPrepTime}
                onChange={(e) => setDraft({ ...draft, reminders: { ...draft.reminders, dailyPrepTime: e.target.value } })}
                className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 font-mono"
              />
            </div>
            <div>
              <p className="text-slate-600 dark:text-neutral-400 mb-1">Payment reminder</p>
              <p className="text-sm text-slate-900 dark:text-white">One day before the monthly payment date</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">
              Polite Fee Reminder Template
            </label>
            <textarea
              rows={3}
              value={draft.reminders.feeMessageTemplate}
              onChange={(e) =>
                setDraft({ ...draft, reminders: { ...draft.reminders, feeMessageTemplate: e.target.value } })
              }
              className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </section>
      </div>

      {/* 4. Data Backup, Restore & Isolated Demo Data */}
      <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">Data Ownership, Backups & Sample Mode</h2>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/backup/export"
            download
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-sky-200 dark:border-white/20 bg-white/80 dark:bg-neutral-950 text-slate-800 dark:text-white"
          >
            <Download className="w-4 h-4" />
            <span>Download workspace JSON</span>
          </a>

          <label className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-sky-200 dark:border-white/20 bg-white/80 dark:bg-neutral-950 text-slate-800 dark:text-white cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Restore JSON Backup</span>
            <input type="file" accept="application/json" onChange={handleImportFile} className="hidden" />
          </label>

          {workspace.hasDemoData ? (
            <button
              type="button"
              onClick={onClearDemo}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-rose-200 dark:border-white/20 text-rose-700 dark:text-neutral-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>Remove Sample Demo Data</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSeedDemo}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border border-sky-200 dark:border-white/20 text-sky-800 dark:text-white"
            >
              <Sparkles className="w-4 h-4" />
              <span>Load Isolated Sample Batch</span>
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-neutral-400">
          Cloudflare Free-Tier Ready: Runs on Cloudflare Workers (100k req/day), Workers Static Assets, and D1 SQLite (5M reads/day, 5 GB storage, 7-day Time Travel) with ₹0 compulsory ongoing fees. See <code className="font-mono">cloudflare/README_DEPLOY.md</code> for step-by-step Wrangler commands.
        </p>
      </section>
    </form>
  );
};
