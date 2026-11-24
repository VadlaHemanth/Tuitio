import { StudentName } from './StudentName';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Layers,
  List,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import type { AttendanceStatus, Student, WorkspaceSnapshot } from '../types';
import {
  addDaysToDateStr,
  diffDaysBetweenDateStrs,
  formatHHMMTo12Hour,
  formatIstTimeHHMM,
  formatRupeesFromPaise,
} from '../engines/istDate';

interface AttendanceViewProps {
  workspace: WorkspaceSnapshot;
  onMarkAttendance: (params: {
    studentId: string;
    date: string;
    status: AttendanceStatus;
    actualArrivalTime?: string | null;
    departureTime?: string | null;
    note?: string;
  }) => Promise<boolean>;
  onBulkMarkAbsent: (date: string, studentIds: string[]) => Promise<void>;
  onOpenStudent: (studentId: string) => void;
}

type ViewTab = 'swipe' | 'list' | 'calendar';

interface UndoEntry {
  studentId: string;
  date: string;
  previousStatus: AttendanceStatus;
  actualArrivalTime?: string | null;
  departureTime?: string | null;
  note?: string;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  workspace,
  onMarkAttendance,
  onBulkMarkAbsent,
  onOpenStudent,
}) => {
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const selectedDate = dateOverride ?? workspace.todayIst;
  const [mode, setMode] = useState<ViewTab>('swipe');
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [confirmEndSession, setConfirmEndSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const lastUndo = undoStack.filter((entry) => entry.date === selectedDate).at(-1);
  const undoStudent = workspace.students.find((student) => student.id === lastUndo?.studentId);

  const activeStudents = useMemo(
    () =>
      workspace.students
        .filter((s) => s.status === 'active')
        .sort((a, b) => a.preferredArrivalTime.localeCompare(b.preferredArrivalTime)),
    [workspace.students],
  );

  const attByStudent = useMemo(() => {
    const m = new Map<string, WorkspaceSnapshot['attendance'][number]>();
    for (const a of workspace.attendance) {
      if (a.date === selectedDate) m.set(a.studentId, a);
    }
    return m;
  }, [workspace.attendance, selectedDate]);

  const unmarkedStudents = useMemo(
    () =>
      activeStudents.filter((s) => {
        const rec = attByStudent.get(s.id);
        return !rec || rec.status === 'unmarked';
      }),
    [activeStudents, attByStudent],
  );

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let unmarked = 0;
    for (const s of activeStudents) {
      const st = attByStudent.get(s.id)?.status ?? 'unmarked';
      if (st === 'present') present += 1;
      else if (st === 'late') late += 1;
      else if (st === 'absent') absent += 1;
      else if (st === 'excused') excused += 1;
      else unmarked += 1;
    }
    return { present, absent, late, excused, unmarked, total: activeStudents.length };
  }, [activeStudents, attByStudent]);

  const recordStatus = useCallback(
    async (student: Student, status: AttendanceStatus) => {
      if (busy) return;
      const previous = attByStudent.get(student.id);
      if (previous?.status === status) return;
      const entry: UndoEntry = {
        studentId: student.id,
        date: selectedDate,
        previousStatus: previous?.status ?? 'unmarked',
        actualArrivalTime: previous?.actualArrivalTime ?? null,
        departureTime: previous?.departureTime ?? null,
        note: previous?.note ?? '',
      };
      setUndoStack((stack) => [...stack.slice(-29), entry]);
      const markedPresent = status === 'present' || status === 'late';
      const saved = await onMarkAttendance({
        studentId: student.id,
        date: selectedDate,
        status,
        actualArrivalTime: markedPresent
          ? previous?.actualArrivalTime ?? (selectedDate === workspace.todayIst ? formatIstTimeHHMM() : null)
          : null,
      });
      if (!saved) setUndoStack((stack) => stack.filter((item) => item !== entry));
    },
    [attByStudent, busy, onMarkAttendance, selectedDate, workspace.todayIst],
  );

  const handleUndo = useCallback(async () => {
    if (!lastUndo || busy) return;
    const { previousStatus, ...entry } = lastUndo;
    setUndoStack((stack) => stack.filter((item) => item !== lastUndo));
    const saved = await onMarkAttendance({ ...entry, status: previousStatus });
    if (!saved) setUndoStack((stack) => [...stack, lastUndo]);
  }, [busy, lastUndo, onMarkAttendance]);

  // Keyboard shortcuts on desktop when in Swipe mode
  useEffect(() => {
    if (mode !== 'swipe') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey ||
        (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable], [role="dialog"]')) ||
        document.querySelector('[aria-modal="true"]')) return;
      const top = unmarkedStudents[0];
      if (e.key === 'ArrowRight' && top) {
        e.preventDefault();
        void recordStatus(top, 'present');
      } else if (e.key === 'ArrowLeft' && top) {
        e.preventDefault();
        void recordStatus(top, 'absent');
      } else if (e.key === 'ArrowUp' && top) {
        e.preventDefault();
        void recordStatus(top, 'late');
      } else if ((e.key === 'z' || e.key === 'Z') && lastUndo) {
        e.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, lastUndo, mode, recordStatus, unmarkedStudents]);

  // Calendar 14-day recent grid
  const calendarDays = useMemo(() => {
    const arr: string[] = [];
    for (let i = 13; i >= 0; i--) {
      arr.push(addDaysToDateStr(workspace.todayIst, -i));
    }
    return arr;
  }, [workspace.todayIst]);

  const currentCard = unmarkedStudents[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Attendance</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Swipe right for present. Swipe left for absent.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            aria-label="Attendance date"
            value={selectedDate}
            onChange={(e) => setDateOverride(e.target.value && e.target.value !== workspace.todayIst ? e.target.value : null)}
            className="px-3 py-2 rounded-xl liquid-glass text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
          />

          <div className="flex items-center p-1 rounded-xl liquid-glass gap-1">
            {(
              [
                { id: 'swipe', label: 'Swipe', icon: Layers },
                { id: 'list', label: 'List', icon: List },
                { id: 'calendar', label: 'History', icon: Calendar },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMode(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    mode === t.id
                      ? 'glass-primary text-white'
                      : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Totals Bar */}
      <div className="liquid-glass rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5 text-xs font-mono tabular-nums">
          <span className="text-emerald-700 dark:text-white font-semibold">Present: {stats.present}</span>
          <span className="text-amber-700 dark:text-neutral-300 font-semibold">Late: {stats.late}</span>
          <span className="text-rose-700 dark:text-neutral-400 font-semibold">Absent: {stats.absent}</span>
          <span className="text-slate-600 dark:text-neutral-400">Excused: {stats.excused}</span>
          <span className="text-sky-700 dark:text-white font-semibold">Unmarked: {stats.unmarked}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!lastUndo || busy}
            onClick={handleUndo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-sky-200 dark:border-white/20 text-slate-700 dark:text-neutral-200 disabled:opacity-40 hover:bg-white dark:hover:bg-white/10 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo{undoStudent ? ` (${undoStudent.nickname || undoStudent.fullName.split(' ')[0]})` : ''}</span>
          </button>

          {stats.unmarked > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => { setBulkError(''); setConfirmEndSession(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-200 dark:border-white/25 text-rose-700 dark:text-neutral-200 hover:bg-rose-50 dark:hover:bg-white/10 whitespace-nowrap"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Mark Remaining Absent</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation dialog for End-of-Session Mark Remaining Absent */}
      {confirmEndSession && (
        <div className="liquid-glass-strong rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-rose-300 dark:border-white/30">
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-slate-950 dark:text-white">
              End-of-session check: Mark {stats.unmarked} unmarked student{stats.unmarked === 1 ? '' : 's'} absent?
            </p>
            <p className="text-xs text-slate-600 dark:text-neutral-400">
              Their assigned homework will be preserved automatically and today’s plan will adjust.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmEndSession(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-medium border border-sky-200 dark:border-white/20 text-slate-700 dark:text-neutral-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setBulkError('');
                try {
                  if (unmarkedStudents.length) await onBulkMarkAbsent(selectedDate, unmarkedStudents.map((s) => s.id));
                  setConfirmEndSession(false);
                } catch (error) {
                  setBulkError(error instanceof Error ? error.message : 'Unable to mark attendance.');
                } finally {
                  setBusy(false);
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 dark:bg-white text-white dark:text-black"
            >
              {busy ? 'Saving…' : 'Confirm Mark Absent'}
            </button>
          </div>
        </div>
      )}
      {bulkError && confirmEndSession && <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{bulkError}</p>}

      {/* MODE 1: SUPER-FAST SWIPE ATTENDANCE */}
      {mode === 'swipe' && (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <div className="attendance-deck lg:col-span-7 flex min-w-0 flex-col items-center">
            {currentCard ? (
              <SwipeAttendanceCard
                key={`${currentCard.id}-${selectedDate}`}
                student={currentCard}
                workspace={workspace}
                selectedDate={selectedDate}
                remainingCount={unmarkedStudents.length}
                disabled={busy}
                onDecide={(status) => recordStatus(currentCard, status)}
                onOpenStudent={onOpenStudent}
              />
            ) : (
              <div className="liquid-glass-strong w-full max-w-md rounded-3xl p-8 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-100 dark:bg-white/10 text-sky-700 dark:text-white flex items-center justify-center">
                  <Check className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                  All {stats.total} students marked for {selectedDate}
                </h2>
                <p className="text-sm text-slate-600 dark:text-neutral-400">
                  {stats.present} present · {stats.late} late · {stats.absent} absent · {stats.excused} excused. Switch to List mode anytime to edit individual records.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  {lastUndo && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="px-4 py-2 rounded-xl text-xs font-semibold border border-sky-200 dark:border-white/20 text-slate-800 dark:text-white"
                    >
                      Undo Last Swipe
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMode('list')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold glass-primary text-white"
                  >
                    Review Full List
                  </button>
                </div>
              </div>
            )}

            <p className="attendance-shortcuts text-xs text-slate-500 dark:text-neutral-500 mt-4 text-center">
              Desktop shortcuts: <span className="font-mono">→</span> Present · <span className="font-mono">←</span> Absent · <span className="font-mono">↑</span> Late · <span className="font-mono">Z</span> Undo
            </p>
          </div>

          {/* Right side queue & recently marked */}
          <div className="lg:col-span-5 liquid-glass rounded-3xl p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-950 dark:text-white">
              Attendance Roll ({stats.total - stats.unmarked}/{stats.total})
            </h2>
            <div className="divide-y divide-sky-100/80 dark:divide-white/10 max-h-[430px] overflow-y-auto">
              {activeStudents.map((s) => {
                const st = attByStudent.get(s.id)?.status ?? 'unmarked';
                return (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      {s.nickname ? (
                        <div>
                          <p className="text-sm font-bold text-slate-950 dark:text-white truncate">{s.nickname}</p>
                          <p className="text-xs font-medium text-slate-500 dark:text-neutral-400 truncate">
                            {s.fullName} · Class {s.classLevel} {s.board} · {formatHHMMTo12Hour(s.preferredArrivalTime)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{s.fullName}</p>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">
                            Class {s.classLevel} · {s.board} · {formatHHMMTo12Hour(s.preferredArrivalTime)}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => recordStatus(s, 'present')}
                        aria-label={`Mark ${s.fullName} present`}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          st === 'present'
                            ? 'bg-emerald-600 text-white dark:bg-white dark:text-black'
                            : 'border border-sky-200 dark:border-white/15 text-slate-600 dark:text-neutral-400'
                        }`}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() => recordStatus(s, 'late')}
                        aria-label={`Mark ${s.fullName} late`}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          st === 'late'
                            ? 'bg-amber-600 text-white dark:bg-neutral-300 dark:text-black'
                            : 'border border-sky-200 dark:border-white/15 text-slate-600 dark:text-neutral-400'
                        }`}
                      >
                        L
                      </button>
                      <button
                        type="button"
                        onClick={() => recordStatus(s, 'absent')}
                        aria-label={`Mark ${s.fullName} absent`}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          st === 'absent'
                            ? 'bg-rose-600 text-white dark:bg-neutral-700 dark:text-white'
                            : 'border border-sky-200 dark:border-white/15 text-slate-600 dark:text-neutral-400'
                        }`}
                      >
                        A
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: COMPACT LIST MODE */}
      {mode === 'list' && (
        <div className="liquid-glass rounded-3xl p-5 sm:p-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-sky-100 dark:border-white/15 text-xs text-slate-500 dark:text-neutral-400">
                <th className="py-2.5 pr-4 font-medium">Student</th>
                <th className="py-2.5 px-3 font-medium">Expected</th>
                <th className="py-2.5 px-3 font-medium">Actual Arrival</th>
                <th className="py-2.5 pl-3 text-right font-medium">Status Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70 dark:divide-white/10 text-sm">
              {activeStudents.map((s) => {
                const rec = attByStudent.get(s.id);
                const status = rec?.status ?? 'unmarked';
                return (
                  <tr key={s.id}>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => onOpenStudent(s.id)}
                        className="hover:underline text-left block"
                      >
                        {s.nickname ? (
                          <div>
                            <span className="font-bold text-sm text-slate-950 dark:text-white">{s.nickname}</span>
                            <span className="block text-xs font-medium text-slate-500 dark:text-neutral-400">{s.fullName}</span>
                          </div>
                        ) : (
                          <span className="font-semibold text-slate-900 dark:text-white">{s.fullName}</span>
                        )}
                      </button>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                        Class {s.classLevel} · {s.board}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-600 dark:text-neutral-400">
                      {formatHHMMTo12Hour(s.preferredArrivalTime)}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-700 dark:text-neutral-300">
                      {rec?.actualArrivalTime ? formatHHMMTo12Hour(rec.actualArrivalTime) : '—'}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {(['present', 'late', 'excused', 'absent'] as AttendanceStatus[]).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => recordStatus(s, opt)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                              status === opt
                                ? 'glass-primary text-white'
                                : 'border border-sky-200/80 dark:border-white/15 text-slate-700 dark:text-neutral-300 hover:bg-sky-50 dark:hover:bg-white/10'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODE 3: 14-DAY CALENDAR HISTORY & MONTHLY SUMMARY */}
      {mode === 'calendar' && (
        <div className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4 overflow-x-auto">
          <div>
            <h2 className="text-base font-bold text-slate-950 dark:text-white">14-Day Attendance History</h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              P = Present · L = Late · A = Absent · E = Excused · — = Unmarked
            </p>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-sky-100 dark:border-white/15 text-slate-500 dark:text-neutral-400">
                <th className="py-2 pr-3 font-medium sticky left-0">Student</th>
                {calendarDays.map((d) => (
                  <th key={d} className="py-2 px-1.5 text-center font-mono tabular-nums">
                    {d.slice(8)}
                  </th>
                ))}
                <th className="py-2 pl-3 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70 dark:divide-white/10">
              {activeStudents.map((s) => {
                let markedCount = 0;
                let presentCount = 0;
                return (
                  <tr key={s.id}>
                    <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                      <StudentName student={s} />
                    </td>
                    {calendarDays.map((d) => {
                      const rec = workspace.attendance.find((a) => a.studentId === s.id && a.date === d);
                      const st = rec?.status ?? 'unmarked';
                      if (st !== 'unmarked') {
                        markedCount += 1;
                        if (st === 'present' || st === 'late') presentCount += 1;
                      }
                      const letter =
                        st === 'present' ? 'P' : st === 'late' ? 'L' : st === 'absent' ? 'A' : st === 'excused' ? 'E' : '·';
                      return (
                        <td
                          key={d}
                          className={`py-2.5 px-1.5 text-center font-mono font-semibold ${
                            st === 'present'
                              ? 'text-emerald-700 dark:text-white'
                              : st === 'absent'
                                ? 'text-rose-600 dark:text-neutral-500'
                                : st === 'late'
                                  ? 'text-amber-700 dark:text-neutral-300'
                                  : 'text-slate-300 dark:text-neutral-700'
                          }`}
                        >
                          {letter}
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-semibold text-slate-800 dark:text-neutral-200">
                      {markedCount > 0 ? `${Math.round((presentCount / markedCount) * 100)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface SwipeCardProps {
  student: Student;
  workspace: WorkspaceSnapshot;
  selectedDate: string;
  remainingCount: number;
  disabled: boolean;
  onDecide: (status: AttendanceStatus) => Promise<void>;
  onOpenStudent: (id: string) => void;
}

const SwipeAttendanceCard: React.FC<SwipeCardProps> = ({
  student,
  workspace,
  selectedDate,
  remainingCount,
  disabled,
  onDecide,
  onOpenStudent,
}) => {
  const card = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const settling = useRef<Animation | null>(null);
  const deciding = useRef(false);
  const dragged = useRef(false);
  const gesture = useRef<{ id: number; x: number; y: number; time: number; width: number; offset: number } | null>(null);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const cardTransform = (offset: number) =>
    `translate3d(${offset}px, 0, 0) rotate(${Math.max(-9, Math.min(9, offset * 0.045))}deg)`;

  const settle = (offset: number, direction: number, status?: AttendanceStatus) => {
    const element = card.current;
    cancelAnimationFrame(frame.current);
    if (!element) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const end = direction ? direction * (element.clientWidth + 28) : 0;
    element.style.transform = '';
    delete element.dataset.swipe;
    const finish = async () => {
      if (!status) return;
      await onDecide(status);
      deciding.current = false;
    };
    if (reduce || typeof element.animate !== 'function' || (!offset && !direction)) {
      void finish();
      return;
    }
    const animation = element.animate([
      { transform: cardTransform(offset), opacity: 1 },
      { transform: cardTransform(end), opacity: direction ? 0 : 1 },
    ], { duration: direction ? 140 : 150, easing: 'cubic-bezier(.2,.75,.22,1)', fill: direction ? 'forwards' : 'none' });
    settling.current = animation;
    void animation.finished.then(finish, finish).finally(() => animation.cancel());
  };

  const decide = (status: AttendanceStatus, offset = 0) => {
    if (disabled || deciding.current) return;
    deciding.current = true;
    const direction = status === 'present' ? 1 : status === 'absent' ? -1 : 0;
    settle(offset, direction, status);
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || disabled || deciding.current) return;
    settling.current?.cancel();
    dragged.current = false;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
      time: event.timeStamp, width: event.currentTarget.clientWidth, offset: 0 };
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId || deciding.current) return;
    const offset = event.clientX - active.x;
    const vertical = Math.abs(event.clientY - active.y);
    if (!dragged.current) {
      if (vertical > 9 && vertical > Math.abs(offset)) { gesture.current = null; return; }
      if (Math.abs(offset) < 8 || Math.abs(offset) <= vertical) return;
      dragged.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    active.offset = offset;
    cancelAnimationFrame(frame.current);
    const element = event.currentTarget;
    frame.current = requestAnimationFrame(() => {
      element.style.transform = cardTransform(offset);
      const hint = offset > 36 ? 'present' : offset < -36 ? 'absent' : '';
      if (element.dataset.swipe !== hint) element.dataset.swipe = hint;
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    gesture.current = null;
    if (!dragged.current) return;
    const cancelled = event.type !== 'pointerup';
    const offset = cancelled ? active.offset : event.clientX - active.x;
    const distance = Math.abs(offset);
    const flick = distance >= 40 && distance / Math.max(1, event.timeStamp - active.time) > 0.5;
    if (!cancelled && !disabled && (distance >= Math.min(96, active.width * 0.24) || flick)) {
      decide(offset > 0 ? 'present' : 'absent', offset);
    } else {
      settle(offset, 0);
    }
  };

  const pendingHwCount = workspace.homework.filter(
    (h) => h.studentId === student.id && h.status !== 'completed' && h.status !== 'verified',
  ).length;

  const nearestExam = workspace.exams
    .filter((e) => e.studentId === student.id && e.obtainedMarks == null && e.examDate >= selectedDate)
    .sort((a, b) => a.examDate.localeCompare(b.examDate))[0];

  const unpaidBalance = workspace.invoices
    .filter((i) => i.studentId === student.id && i.status !== 'paid' && i.status !== 'waived')
    .reduce((sum, i) => sum + Math.max(0, i.totalAmountPaise - i.paidAmountPaise), 0);

  const lastAttendance = workspace.attendance
    .filter((a) => a.studentId === student.id && a.date < selectedDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const initials = (student.nickname || student.fullName)
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full max-w-md space-y-4">
      <div
        ref={card}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={(event) => {
          if (event.target === event.currentTarget) endDrag(event);
        }}
        onPointerLeave={(event) => {
          if (!dragged.current && event.pointerType === 'mouse') gesture.current = null;
        }}
        onClickCapture={(event) => {
          if (event.detail && (dragged.current || deciding.current)) event.stopPropagation();
        }}
        className="attendance-card relative liquid-glass-strong rounded-3xl p-5 sm:p-6 cursor-grab active:cursor-grabbing select-none"
      >
        <div
          aria-hidden="true"
          className="swipe-hint swipe-hint-present absolute top-4 right-4 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-lg border border-emerald-600 text-emerald-800 dark:text-emerald-200 font-display font-bold text-xs"
        >
          PRESENT
        </div>
        <div
          aria-hidden="true"
          className="swipe-hint swipe-hint-absent absolute top-4 left-4 bg-rose-50 dark:bg-rose-950 px-3 py-1 rounded-lg border border-rose-600 text-rose-800 dark:text-rose-200 font-display font-bold text-xs"
        >
          ABSENT
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400 mb-5">
          <span>{remainingCount} unmarked</span>
          <span className="font-mono tabular-nums">{student.studentCode}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl glass-primary text-white flex items-center justify-center font-display font-bold text-xl shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            {student.nickname ? (
              <div>
                <button
                  type="button"
                  onClick={() => onOpenStudent(student.id)}
                  className="text-2xl font-black text-slate-950 dark:text-white hover:underline text-left truncate block max-w-full"
                >
                  {student.nickname}
                </button>
                <p className="text-xs font-semibold text-slate-500 dark:text-neutral-400">
                  {student.fullName}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onOpenStudent(student.id)}
                className="text-xl font-bold text-slate-950 dark:text-white hover:underline text-left truncate block max-w-full"
              >
                {student.fullName}
              </button>
            )}
            <p className="text-sm text-slate-600 dark:text-neutral-300">
              Class {student.classLevel} · {student.board} · {student.schoolName || 'Regular Batch'}
            </p>
            <p className="text-xs font-mono tabular-nums text-sky-700 dark:text-neutral-400 mt-1 inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Expected {formatHHMMTo12Hour(student.preferredArrivalTime)} ({student.allocatedSlot})
            </p>
          </div>
        </div>

        {/* Context Summary */}
        <div className="mt-6 pt-5 border-t border-sky-100 dark:border-white/15 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-slate-500 dark:text-neutral-500">Last Attendance</p>
            <p className="font-medium text-slate-900 dark:text-white mt-0.5 capitalize">
              {lastAttendance ? `${lastAttendance.status} (${lastAttendance.date})` : 'First recorded day'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-neutral-500">Homework Pending</p>
            <p className="font-mono tabular-nums font-medium text-slate-900 dark:text-white mt-0.5">
              {pendingHwCount} active task{pendingHwCount === 1 ? '' : 's'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-neutral-500">Upcoming Exam</p>
            <p className="font-medium text-slate-900 dark:text-white mt-0.5 truncate">
              {nearestExam
                ? `${nearestExam.subject} (${diffDaysBetweenDateStrs(selectedDate, nearestExam.examDate)}d)`
                : 'None in queue'}
            </p>
          </div>
          <div>
            <p className="text-slate-500 dark:text-neutral-500">Fee Status</p>
            <p className="font-mono tabular-nums font-medium text-slate-900 dark:text-white mt-0.5">
              {unpaidBalance > 0 ? `${formatRupeesFromPaise(unpaidBalance)} due` : 'All clear'}
            </p>
          </div>
        </div>
      </div>

      {/* Tactile Action Controls (Large Touch Targets >= 48px) */}
      <div className="grid grid-cols-4 gap-2.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => decide('absent')}
          className="min-h-[52px] rounded-2xl border border-rose-200 dark:border-white/20 bg-white/80 dark:bg-neutral-950 hover:bg-rose-50 dark:hover:bg-neutral-900 text-rose-700 dark:text-neutral-200 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-transform active:scale-95"
        >
          <UserX className="w-4 h-4" />
          <span>Absent</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => decide('excused')}
          className="min-h-[52px] rounded-2xl border border-sky-200/80 dark:border-white/15 bg-white/80 dark:bg-neutral-950 hover:bg-sky-50 dark:hover:bg-neutral-900 text-slate-700 dark:text-neutral-300 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-transform active:scale-95"
        >
          <X className="w-4 h-4" />
          <span>Leave</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => decide('late')}
          className="min-h-[52px] rounded-2xl border border-amber-200 dark:border-white/20 bg-white/80 dark:bg-neutral-950 hover:bg-amber-50 dark:hover:bg-neutral-900 text-amber-800 dark:text-neutral-200 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-transform active:scale-95"
        >
          <Clock className="w-4 h-4" />
          <span>Late</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => decide('present')}
          className="min-h-[52px] rounded-2xl glass-primary text-white flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-transform active:scale-95"
        >
          <UserCheck className="w-4 h-4" />
          <span>Present</span>
        </button>
      </div>
    </div>
  );
};
