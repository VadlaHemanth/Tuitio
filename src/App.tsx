import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  GraduationCap,
  Home,
  IndianRupee,
  LogOut,
  Menu,
  Moon,
  Play,
  Search,
  Settings,
  Smartphone,
  Sun,
  UserCheck,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  AttendanceRecord,
  BoardType,
  ScheduleBlock,
  StudentStatus,
  TuitionSettings,
  WorkspaceSnapshot,
} from './types';
import {
  apiRequest,
  cacheWorkspaceSnapshot,
  clearCachedWorkspaceSnapshot,
  flushOfflineQueue,
  getOfflineQueue,
  loadCachedWorkspaceSnapshot,
  OfflineQueuedError,
  setAuthToken,
} from './lib/api';
import { generateDailyTuitionPlan } from './engines/schedulerEngine';
import { formatIstDate } from './engines/istDate';
import { useTheme } from './hooks/useTheme';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import { AuthOnboarding } from './components/AuthOnboarding';
import { CommandPalette, type NavSection } from './components/CommandPalette';
import { CommandCenter } from './components/CommandCenter';
import { AttendanceView } from './components/AttendanceView';

const StudentsView = lazy(() => import('./components/StudentsView').then((module) => ({ default: module.StudentsView })));
const PlannerView = lazy(() => import('./components/PlannerView').then((module) => ({ default: module.PlannerView })));
const HomeworkView = lazy(() => import('./components/HomeworkExamsView').then((module) => ({ default: module.HomeworkView })));
const ExamsView = lazy(() => import('./components/HomeworkExamsView').then((module) => ({ default: module.ExamsView })));
const FeesView = lazy(() => import('./components/FeesView').then((module) => ({ default: module.FeesView })));
const NotificationsView = lazy(() => import('./components/NotificationsReportsSettings').then((module) => ({ default: module.NotificationsView })));
const ReportsView = lazy(() => import('./components/NotificationsReportsSettings').then((module) => ({ default: module.ReportsView })));
const SettingsView = lazy(() => import('./components/NotificationsReportsSettings').then((module) => ({ default: module.SettingsView })));

interface AuthState {
  loading: boolean;
  initialized: boolean;
  authenticated: boolean;
  teacher: { id: string; email: string; name: string } | null;
}

type AttendanceEdit = Pick<AttendanceRecord, 'studentId' | 'date' | 'status' | 'actualArrivalTime' | 'departureTime' | 'note'>;

function applyAttendance(records: AttendanceRecord[], edit: AttendanceEdit, record?: AttendanceRecord | null) {
  const existing = records.find((item) => item.studentId === edit.studentId && item.date === edit.date);
  const rest = records.filter((item) => item !== existing);
  if (edit.status === 'unmarked') return rest;
  return [record ?? { id: `pending:${edit.studentId}:${edit.date}`, updatedAt: '', ...existing, ...edit }, ...rest];
}

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: UserCheck },
  { id: 'planner', label: 'Daily Planner', icon: CalendarClock },
  { id: 'homework', label: 'Homework', icon: BookOpen },
  { id: 'exams', label: 'Exams', icon: GraduationCap },
  { id: 'fees', label: 'Fees', icon: IndianRupee },
  { id: 'notifications', label: 'Alerts', icon: Bell },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [auth, setAuth] = useState<AuthState>({
    loading: true,
    initialized: false,
    authenticated: false,
    teacher: null,
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [savedWorkspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [attendanceEdits, setAttendanceEdits] = useState<AttendanceEdit[]>([]);
  const attendanceWrites = useRef(Promise.resolve());
  const workspace = useMemo(() => {
    if (!savedWorkspace) return savedWorkspace;
    const superseded = new Set(savedWorkspace.homework.map((task) => task.carriedFromId).filter(Boolean));
    return {
      ...savedWorkspace,
      homework: superseded.size ? savedWorkspace.homework.filter((task) => !superseded.has(task.id)) : savedWorkspace.homework,
      attendance: attendanceEdits.reduce((records, edit) => applyAttendance(records, edit), savedWorkspace.attendance),
    };
  }, [savedWorkspace, attendanceEdits]);
  const [section, setSection] = useState<NavSection>(() => new URLSearchParams(window.location.search).get('view') === 'notifications' ? 'notifications' : 'dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [feePaymentStudentId, setFeePaymentStudentId] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [blockOverrides, setBlockOverrides] = useState<Partial<Record<ScheduleBlock['mode'], number>>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(() => getOfflineQueue().length);

  const { preference: theme, setPreference: setTheme, resolvedTheme } = useTheme('system');
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section, selectedStudentId, liveMode]);

  useEffect(() => {
    if (!mobileMoreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMoreOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileMoreOpen]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur));
    }, 3200);
  }, []);

  const safeSetWorkspace = useCallback((response: unknown) => {
    if (!response || typeof response !== 'object') throw new Error('The server returned an invalid workspace.');
    const snapshot = ('snapshot' in response ? response.snapshot : response) as WorkspaceSnapshot | null;
    if (!snapshot || !Array.isArray(snapshot.students) || !Array.isArray(snapshot.homework) || !Array.isArray(snapshot.attendance)) {
      throw new Error('The server returned an invalid workspace.');
    }
    setWorkspace(snapshot);
    cacheWorkspaceSnapshot(snapshot);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setWorkspaceError(null);
    try {
      safeSetWorkspace(await apiRequest('/api/workspace'));
    } catch (error) {
      const cached = loadCachedWorkspaceSnapshot();
      if (cached) {
        setWorkspace(cached);
        showToast('Showing cached offline workspace data.');
      } else {
        setWorkspaceError(error instanceof Error ? error.message : 'Unable to load the workspace.');
      }
    }
  }, [safeSetWorkspace, showToast]);

  // Initial auth check + ?autostart=1 support for uninitialized first launch
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await apiRequest<{
          initialized: boolean;
          authenticated: boolean;
          teacher: { id: string; email: string; name: string } | null;
        }>('/api/auth/status');

        if (!active) return;

        const params = new URLSearchParams(window.location.search);
        const autoStart = params.get('autostart') === '1';

        if (!status.authenticated && autoStart) {
          try {
            const demo = await apiRequest<{
              token: string;
              teacher: { id: string; email: string; name: string };
            }>('/api/auth/demo-bootstrap', { method: 'POST', body: {} });
            setAuthToken(demo.token);
            if (!active) return;
            setAuth({ loading: false, initialized: true, authenticated: true, teacher: demo.teacher });
            await loadWorkspace();
            return;
          } catch {
            // If workspace is already claimed by a real teacher, stay on Login screen!
          }
        }

        setAuth({
          loading: false,
          initialized: status.initialized,
          authenticated: status.authenticated,
          teacher: status.teacher,
        });

        if (status.authenticated) {
          await loadWorkspace();
        }
      } catch (error) {
        if (!active) return;
        setAuthError(error instanceof Error ? error.message : 'Unable to reach Tuitio.');
        setAuth({ loading: false, initialized: false, authenticated: false, teacher: null });
      }
    })();
    return () => {
      active = false;
    };
  }, [authAttempt, loadWorkspace]);

  // Flush queued offline attendance/homework updates when reconnecting
  useEffect(() => {
    if (isOnline && auth.authenticated) {
      flushOfflineQueue().then((res) => {
        setPendingOfflineCount(res.remaining);
        if (res.synced > 0) {
          showToast(`Synced ${res.synced} offline update${res.synced === 1 ? '' : 's'}.`);
          void loadWorkspace();
        }
      }).catch(() => showToast('Offline updates could not sync.'));
    }
  }, [isOnline, auth.authenticated, loadWorkspace, showToast]);

  const loadedDate = workspace?.todayIst;
  useEffect(() => {
    if (!loadedDate || !auth.authenticated || !isOnline) return;
    const refreshWorkspaceDate = () => {
      if (!document.hidden && formatIstDate() !== loadedDate) void loadWorkspace();
    };
    refreshWorkspaceDate();
    const interval = window.setInterval(refreshWorkspaceDate, 60_000);
    document.addEventListener('visibilitychange', refreshWorkspaceDate);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWorkspaceDate);
    };
  }, [auth.authenticated, isOnline, loadedDate, loadWorkspace]);

  // Cmd/Ctrl + K Command Palette shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const dailyPlan = useMemo(() => {
    if (!workspace) return null;
    return generateDailyTuitionPlan({
      date: workspace.todayIst,
      settings: workspace.settings,
      students: workspace.students,
      attendance: workspace.attendance,
      homework: workspace.homework,
      exams: workspace.exams,
      invoices: workspace.invoices,
      customBlockOverrides: blockOverrides,
    });
  }, [workspace, blockOverrides]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const openAlerts = (event: MessageEvent) => {
      if (event.data?.type !== 'open-fee-alerts') return;
      setSection('notifications');
      if (auth.authenticated) void loadWorkspace();
    };
    navigator.serviceWorker.addEventListener('message', openAlerts);
    return () => navigator.serviceWorker.removeEventListener('message', openAlerts);
  }, [auth.authenticated, loadWorkspace]);

  const unreadAlerts = useMemo(
    () => workspace?.notifications.filter((n) => !n.read).length ?? 0,
    [workspace],
  );

  const toggleLightDark = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleNavigate = (next: NavSection) => {
    setLiveMode(false);
    setMobileMoreOpen(false);
    setSection(next);
    if (next !== 'students') setSelectedStudentId(null);
  };

  const handleOpenStudent = (studentId: string) => {
    setLiveMode(false);
    setSelectedStudentId(studentId);
    setSection('students');
  };

  const handleLogout = async () => {
    await attendanceWrites.current;
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    clearCachedWorkspaceSnapshot();
    setWorkspace(null);
    setAuth((prev) => ({ ...prev, authenticated: false, teacher: null }));
  };

  // --- MUTATION HANDLERS ---
  const markAttendance = useCallback((edit: AttendanceEdit) => {
    setAttendanceEdits((items) => [...items, edit]);
    const write = attendanceWrites.current.then(async () => {
      let result: AttendanceRecord | null | undefined;
      try {
        if (navigator.onLine && getOfflineQueue().length) await flushOfflineQueue();
        const response = await apiRequest<{ attendance: AttendanceRecord | null }>('/api/attendance?response=record', {
          method: 'POST',
          body: edit,
          queueableOffline: true,
          offlineLabel: `Attendance ${edit.status}`,
        });
        result = response.attendance;
      } catch (error) {
        if (!(error instanceof OfflineQueuedError)) {
          showToast(error instanceof Error ? error.message : 'Unable to update attendance.');
          return false;
        }
        setPendingOfflineCount(getOfflineQueue().length);
        showToast(error.message);
      } finally {
        setAttendanceEdits((items) => items.filter((item) => item !== edit));
      }
      setWorkspace((current) => current ? { ...current, attendance: applyAttendance(current.attendance, edit, result) } : current);
      return true;
    });
    attendanceWrites.current = write.then(() => {});
    return write;
  }, [showToast]);

  const bulkMarkAbsent = async (date: string, studentIds: string[]) => {
    const write = attendanceWrites.current.then(async () => {
      await flushOfflineQueue();
      const res = await apiRequest<WorkspaceSnapshot>('/api/attendance/bulk', {
        method: 'POST',
        body: { date, entries: studentIds.map((studentId) => ({ studentId, status: 'absent' })) },
      });
      safeSetWorkspace(res);
      showToast(`Marked ${studentIds.length} remaining student${studentIds.length === 1 ? '' : 's'} absent.`);
    });
    attendanceWrites.current = write.catch(() => {});
    return write;
  };

  const updateHomework = async (id: string, patch: Record<string, unknown>) => {
    try {
      const snap = await apiRequest<WorkspaceSnapshot>(`/api/homework/${id}`, {
        method: 'PUT',
        body: patch,
        queueableOffline: true,
        offlineLabel: 'Homework status update',
      });
      safeSetWorkspace(snap);
      showToast('Homework updated.');
    } catch (err) {
      setPendingOfflineCount(getOfflineQueue().length);
      showToast(err instanceof Error ? err.message : 'Unable to update homework.');
    }
  };

  // --- LOADING / AUTH GATES ---
  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="liquid-glass rounded-3xl px-8 py-6 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl glass-primary text-white font-display font-extrabold flex items-center justify-center text-lg">
            T
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-neutral-300">Loading Tuitio workspace...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <main className="min-h-dvh grid place-items-center p-4">
        <div className="liquid-glass-strong w-full max-w-sm rounded-3xl p-6 space-y-3">
          <h1 className="text-lg font-bold">Unable to load Tuitio</h1>
          <p className="text-sm" role="alert">{authError}</p>
          <button type="button" className="glass-primary rounded-xl px-4 py-2 text-sm" onClick={() => {
            setAuthError(null);
            setAuth((status) => ({ ...status, loading: true }));
            setAuthAttempt((attempt) => attempt + 1);
          }}>Retry</button>
        </div>
      </main>
    );
  }

  if (!auth.authenticated) {
    return (
      <AuthOnboarding
        initialized={auth.initialized}
        theme={resolvedTheme}
        onToggleTheme={toggleLightDark}
        onAuthenticated={(teacher) => {
          setAuth({ loading: false, initialized: true, authenticated: true, teacher });
          void loadWorkspace();
        }}
      />
    );
  }

  if (!workspace || !dailyPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="liquid-glass rounded-3xl p-8 max-w-md w-full space-y-3">
          {workspaceError ? (
            <>
              <p className="text-sm" role="alert">{workspaceError}</p>
              <button className="glass-primary rounded-xl px-4 py-2 text-sm" type="button" onClick={loadWorkspace}>Retry</button>
            </>
          ) : <p className="text-sm" role="status">Loading workspace…</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col lg:flex-row">
      {/* DESKTOP SIDEBAR (252px) */}
      <aside className="glass-chrome hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:sticky lg:top-0 lg:h-dvh p-4 border-r no-print">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div className="w-9 h-9 rounded-xl glass-primary text-white flex items-center justify-center font-display font-extrabold text-lg shrink-0">
            T
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-slate-950 dark:text-white truncate">
              {workspace.settings.tuitionName.split('—')[0].trim()}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
              {workspace.settings.teacherName}
            </p>
          </div>
        </div>

        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto" aria-label="Main workspace navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id && !liveMode;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'glass-primary text-white font-semibold'
                    : 'text-slate-700 dark:text-neutral-300 hover:bg-sky-50/90 dark:hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'notifications' && unreadAlerts > 0 && (
                  <span className={`font-mono text-[11px] ${active ? 'text-white/90' : 'text-sky-700 dark:text-sky-200'}`}>
                    {unreadAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-3 border-t border-sky-200/70 dark:border-white/12 space-y-1.5">
          {isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={install}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-sky-50 dark:bg-neutral-900 text-sky-800 dark:text-white hover:bg-sky-100 dark:hover:bg-neutral-800"
            >
              <Smartphone className="w-4 h-4 shrink-0" />
              <span className="truncate">Install Tuitio PWA</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-neutral-400 hover:bg-sky-50 dark:hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* TOP HEADER BAR (Compact on mobile <= 56px so mobile sticky stays well below 15%) */}
        <header className="app-toolbar glass-chrome sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-3 border-b no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className="lg:hidden font-display font-bold text-base text-slate-950 dark:text-white whitespace-nowrap shrink-0"
            >
              Tuitio
            </button>
            <span className="hidden lg:inline text-sm font-semibold text-slate-800 dark:text-neutral-200 capitalize whitespace-nowrap">
              {liveMode ? 'Live Tuition Session' : NAV_ITEMS.find((n) => n.id === section)?.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Global search"
              className="inline-flex min-h-11 lg:min-h-9 items-center gap-2 px-3 rounded-xl border border-sky-200/80 dark:border-white/15 bg-white/65 dark:bg-neutral-950/60 text-xs text-slate-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-900 whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search...</span>
              <span className="hidden md:inline font-mono text-[10px] text-slate-400">⌘K</span>
            </button>

            <button
              type="button"
              onClick={toggleLightDark}
              aria-label="Toggle Light and Dark theme"
              className="grid size-11 lg:size-9 place-items-center rounded-xl border border-sky-200/80 dark:border-white/15 bg-white/65 dark:bg-neutral-950/60 text-slate-700 dark:text-white hover:bg-white dark:hover:bg-neutral-900 shrink-0"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setSection('dashboard');
                setLiveMode((v) => !v);
              }}
              className="inline-flex min-h-11 lg:min-h-9 items-center gap-1.5 px-3.5 rounded-xl text-xs font-semibold glass-primary whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{liveMode ? 'Dashboard' : 'Live Mode'}</span>
            </button>
          </div>
        </header>

        {/* MAIN WORKSPACE */}
        <main className="app-content flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-10">
          <Suspense fallback={<p className="liquid-glass rounded-2xl p-5 text-sm" role="status">Loading {NAV_ITEMS.find((item) => item.id === section)?.label.toLowerCase()}…</p>}>
          {section === 'dashboard' && (
            <CommandCenter
              workspace={workspace}
              dailyPlan={dailyPlan}
              liveMode={liveMode}
              onSetLiveMode={setLiveMode}
              onNavigate={handleNavigate}
              onOpenStudent={handleOpenStudent}
              onQuickHomeworkUpdate={updateHomework}
              onQuickAttendance={async (studentId, status) => {
                await markAttendance({ studentId, date: workspace.todayIst, status });
              }}
            />
          )}

          {section === 'students' && (
            <StudentsView
              workspace={workspace}
              selectedStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
              onCreateStudent={async (payload) => {
                const res = await apiRequest<{ id: string; snapshot: WorkspaceSnapshot }>('/api/students', {
                  method: 'POST',
                  body: payload,
                });
                safeSetWorkspace(res);
                showToast('Student enrolled with automatic fee calculation.');
              }}
              onUpdateStudent={async (id, payload) => {
                const snap = await apiRequest<WorkspaceSnapshot>(`/api/students/${id}`, {
                  method: 'PUT',
                  body: payload,
                });
                safeSetWorkspace(snap);
                showToast('Student profile saved.');
              }}
              onChangeStatus={async (id, status: StudentStatus) => {
                const snap = await apiRequest<WorkspaceSnapshot>(`/api/students/${id}/status`, {
                  method: 'POST',
                  body: { status },
                });
                safeSetWorkspace(snap);
                showToast(`Student status updated to ${status} (history preserved).`);
              }}
              onPermanentDelete={async (id) => {
                const snap = await apiRequest<WorkspaceSnapshot>(`/api/students/${id}`, {
                  method: 'DELETE',
                  body: { confirmDelete: true },
                });
                safeSetWorkspace(snap);
                showToast('Student record permanently removed.');
              }}
              onPromoteStudents={async (params: {
                studentIds: string[];
                overridePolicy: 'keep_override' | 'adopt_class_rate';
                targetBoard?: BoardType;
              }) => {
                const res = await apiRequest<any>(
                  '/api/students/promote',
                  { method: 'POST', body: params },
                );
                safeSetWorkspace(res);
                showToast(`Promoted ${res?.promoted ?? 0}, graduated ${res?.graduated ?? 0}. Historical invoices preserved.`);
              }}
              onRecordPaymentShortcut={(studentId) => {
                setFeePaymentStudentId(studentId);
                setSection('fees');
              }}
            />
          )}

          {section === 'attendance' && (
            <AttendanceView
              workspace={workspace}
              onMarkAttendance={markAttendance}
              onBulkMarkAbsent={bulkMarkAbsent}
              onOpenStudent={handleOpenStudent}
            />
          )}

          {section === 'planner' && (
            <PlannerView
              workspace={workspace}
              dailyPlan={dailyPlan}
              blockOverrides={blockOverrides}
              onUpdateBlockDuration={(mode, minutes) =>
                setBlockOverrides((prev) => ({ ...prev, [mode]: minutes }))
              }
              onResetOverrides={() => setBlockOverrides({})}
              onStartLiveMode={() => {
                setSection('dashboard');
                setLiveMode(true);
              }}
              onSaveProgress={async (payload) => {
                const snap = await apiRequest<WorkspaceSnapshot>('/api/progress', {
                  method: 'POST',
                  body: payload,
                });
                safeSetWorkspace(snap);
                showToast('Daily student progress saved.');
              }}
              onOpenStudent={handleOpenStudent}
            />
          )}

          {section === 'homework' && (
            <HomeworkView
              workspace={workspace}
              onCreateHomework={async (payload) => {
                const snap = await apiRequest<WorkspaceSnapshot>('/api/homework', {
                  method: 'POST',
                  body: payload,
                });
                safeSetWorkspace(snap);
                showToast('Homework assigned.');
              }}
              onUpdateHomework={updateHomework}
              onDeleteHomework={async (id) => {
                const snap = await apiRequest<WorkspaceSnapshot>(`/api/homework/${id}`, { method: 'DELETE' });
                safeSetWorkspace(snap);
                showToast('Homework removed.');
              }}
              onCarryForward={async () => {
                const res = await apiRequest<any>(
                  '/api/homework/carry-forward',
                  { method: 'POST', body: {} },
                );
                safeSetWorkspace(res);
                return res?.carriedCount ?? 0;
              }}
            />
          )}

          {section === 'exams' && (
            <ExamsView
              workspace={workspace}
              onCreateExam={async (payload) => {
                const snap = await apiRequest<WorkspaceSnapshot>('/api/exams', {
                  method: 'POST',
                  body: payload,
                });
                safeSetWorkspace(snap);
                showToast('Examination scheduled.');
              }}
              onUpdateExam={async (id, patch) => {
                const snap = await apiRequest<WorkspaceSnapshot>(`/api/exams/${id}`, {
                  method: 'PUT',
                  body: patch,
                });
                safeSetWorkspace(snap);
                showToast('Examination updated.');
              }}
              onDeleteExam={async (id) => {
                const snap = await apiRequest<WorkspaceSnapshot>(`/api/exams/${id}`, { method: 'DELETE' });
                safeSetWorkspace(snap);
                showToast('Examination removed.');
              }}
            />
          )}

          {section === 'fees' && (
            <FeesView
              workspace={workspace}
              initialPaymentStudentId={feePaymentStudentId}
              onClearInitialPaymentStudent={() => setFeePaymentStudentId(null)}
              onRecordPayment={async (payload) => {
                const res = await apiRequest<{ receiptNumber: string; snapshot: WorkspaceSnapshot }>(
                  '/api/fees/payments',
                  { method: 'POST', body: payload },
                );
                safeSetWorkspace(res);
                showToast(`Payment recorded. Receipt ${res.receiptNumber} is ready.`);
              }}
              onEditInvoice={async (invoiceId, patch) => {
                const snap = await apiRequest<WorkspaceSnapshot>(`/api/fees/invoices/${invoiceId}`, {
                  method: 'PUT', body: patch,
                });
                safeSetWorkspace(snap);
                showToast(patch.waived === true ? 'Fee balance waived.' : patch.waived === false ? 'Fee balance restored.' : 'Due date updated.');
              }}
              onCreateDiscount={async (payload) => {
                const snap = await apiRequest<WorkspaceSnapshot>('/api/discounts', {
                  method: 'POST',
                  body: payload,
                });
                safeSetWorkspace(snap);
                showToast('Discount rule added.');
              }}
              onDeleteDiscount={async (id) => {
                const snap = await apiRequest<WorkspaceSnapshot>(`/api/discounts/${id}`, { method: 'DELETE' });
                safeSetWorkspace(snap);
                showToast('Discount removed.');
              }}
            />
          )}

          {section === 'notifications' && (
            <NotificationsView
              workspace={workspace}
              onMarkRead={async (id) => {
                const snap = await apiRequest<WorkspaceSnapshot>(`/api/notifications/${id}/read`, { method: 'POST' });
                safeSetWorkspace(snap);
              }}
              onMarkAllRead={async () => {
                const snap = await apiRequest<WorkspaceSnapshot>('/api/notifications/read-all', { method: 'POST' });
                safeSetWorkspace(snap);
                showToast('All alerts marked read.');
              }}
            />
          )}

          {section === 'reports' && <ReportsView workspace={workspace} />}

          {section === 'settings' && (
            <SettingsView
              workspace={workspace}
              theme={theme}
              onChangeTheme={setTheme}
              onSaveSettings={async (next: TuitionSettings) => {
                const snap = await apiRequest<WorkspaceSnapshot>('/api/settings', {
                  method: 'PUT',
                  body: next,
                });
                safeSetWorkspace(snap);
                showToast('Settings saved.');
              }}
              onSeedDemo={async () => {
                const snap = await apiRequest<WorkspaceSnapshot>('/api/demo/seed', { method: 'POST' });
                safeSetWorkspace(snap);
                showToast('Isolated sample batch loaded.');
              }}
              onClearDemo={async () => {
                const snap = await apiRequest<WorkspaceSnapshot>('/api/demo/clear', { method: 'POST' });
                safeSetWorkspace(snap);
                showToast('Sample demo data removed.');
              }}
              onRestoreBackup={async (json) => {
                const snap = await apiRequest<WorkspaceSnapshot>('/api/backup/restore', {
                  method: 'POST',
                  body: json,
                });
                safeSetWorkspace(snap);
                showToast('Workspace restored from backup.');
              }}
            />
          )}
          </Suspense>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR: Home | Students | Attendance | Planner | More */}
      <nav
        aria-label="Mobile navigation"
        className="app-dock glass-chrome lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t grid grid-cols-5 items-center no-print"
      >
        {(
          [
            { id: 'dashboard', label: 'Home', icon: Home },
            { id: 'students', label: 'Students', icon: Users },
            { id: 'attendance', label: 'Attendance', icon: UserCheck },
            { id: 'planner', label: 'Planner', icon: CalendarClock },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = section === item.id && !mobileMoreOpen && !liveMode;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              data-active={active}
              className={`min-h-12 flex flex-col items-center justify-center text-[11px] font-semibold ${
                active
                  ? 'text-sky-800 dark:text-sky-200'
                  : 'text-slate-600 dark:text-neutral-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMoreOpen((v) => !v)}
          aria-expanded={mobileMoreOpen}
          data-active={mobileMoreOpen || ['homework', 'exams', 'fees', 'notifications', 'reports', 'settings'].includes(section)}
          className={`min-h-12 flex flex-col items-center justify-center text-[11px] font-semibold ${
            mobileMoreOpen || ['homework', 'exams', 'fees', 'notifications', 'reports', 'settings'].includes(section)
              ? 'text-sky-800 dark:text-sky-200'
              : 'text-slate-600 dark:text-neutral-300'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>

      {/* MOBILE "MORE" BOTTOM SHEET */}
      {mobileMoreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/50 dark:bg-black/80 flex items-end"
          onClick={() => setMobileMoreOpen(false)}
        >
          <div
            className="glass-dialog-panel w-full rounded-t-3xl liquid-glass-strong p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-neutral-700 mx-auto" />
            <div className="flex items-center justify-between">
              <p id="mobile-menu-title" className="text-base font-bold text-slate-950 dark:text-white">More workspaces</p>
              <button type="button" onClick={() => setMobileMoreOpen(false)} aria-label="Close drawer" className="grid size-11 place-items-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {NAV_ITEMS.filter((i) => !['dashboard', 'students', 'attendance', 'planner'].includes(i.id)).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className="min-h-[68px] p-3 rounded-2xl border border-sky-200/80 dark:border-white/15 bg-white/80 dark:bg-neutral-950 flex flex-col items-center justify-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white"
                  >
                    <Icon className="w-5 h-5 text-sky-600 dark:text-white" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-sky-100 dark:border-white/15">
              {isInstallable && !isInstalled ? (
                <button
                  type="button"
                  onClick={install}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-white"
                >
                  <Smartphone className="w-4 h-4" /> Install App
                </button>
              ) : (
                <span className="text-xs text-slate-500 dark:text-neutral-400">{auth.teacher?.name}</span>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-neutral-300"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFLINE BANNER */}
      {!isOnline && (
        <div className="app-bottom-notice fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-700 text-white px-3.5 py-2 text-xs font-semibold shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode · {pendingOfflineCount} queued</span>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div
          role="status"
          className="app-bottom-notice pointer-events-none fixed bottom-20 lg:bottom-5 right-4 left-4 sm:left-auto z-50 liquid-glass-strong rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white shadow-xl"
        >
          {toast}
        </div>
      )}

      {/* COMMAND PALETTE */}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        workspace={workspace}
        onNavigate={handleNavigate}
        onOpenStudent={handleOpenStudent}
        onStartLiveMode={() => {
          setSection('dashboard');
          setLiveMode(true);
        }}
      />
    </div>
  );
}
