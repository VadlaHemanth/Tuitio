import { StudentName } from './StudentName';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Forward,
  GraduationCap,
  HelpCircle,
  Mic,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { ExamItem, ExamType, HomeworkSource, PriorityLevel, WorkspaceSnapshot } from '../types';
import { addDaysToDateStr, diffDaysBetweenDateStrs } from '../engines/istDate';

// --- HOMEWORK VIEW ---

interface HomeworkViewProps {
  workspace: WorkspaceSnapshot;
  onCreateHomework: (payload: Record<string, unknown>) => Promise<void>;
  onUpdateHomework: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDeleteHomework: (id: string) => Promise<void>;
  onCarryForward: () => Promise<number>;
}

export const HomeworkView: React.FC<HomeworkViewProps> = ({
  workspace,
  onCreateHomework,
  onUpdateHomework,
  onDeleteHomework,
  onCarryForward,
}) => {
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all' | 'completed'>('pending');
  const [showAddModal, setShowAddModal] = useState(false);
  const [carryNotice, setCarryNotice] = useState<string | null>(null);
  const [carrying, setCarrying] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [actionError, setActionError] = useState('');

  // Quick Add state
  const [targetStudents, setTargetStudents] = useState<string[]>([]);
  const [subject, setSubject] = useState('Mathematics');
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(addDaysToDateStr(workspace.todayIst, 1));
  const [estimatedMinutes, setEstimatedMinutes] = useState(20);
  const [priority, setPriority] = useState<PriorityLevel>('normal');
  const [source, setSource] = useState<HomeworkSource>('tuition');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeStudents = useMemo(
    () => workspace.students.filter((s) => s.status === 'active'),
    [workspace.students],
  );
  const studentMap = useMemo(() => new Map(workspace.students.map((s) => [s.id, s])), [workspace.students]);

  const filteredHw = useMemo(() => {
    return workspace.homework.filter((h) => {
      if (filterStudent !== 'all' && h.studentId !== filterStudent) return false;
      const done = h.status === 'completed' || h.status === 'verified';
      if (filterStatus === 'pending' && done) return false;
      if (filterStatus === 'completed' && !done) return false;
      return true;
    });
  }, [workspace.homework, filterStudent, filterStatus]);

  const groupedByStudent = useMemo(() => {
    const map = new Map<string, typeof filteredHw>();
    for (const h of filteredHw) {
      const list = map.get(h.studentId) ?? [];
      list.push(h);
      map.set(h.studentId, list);
    }
    return Array.from(map.entries());
  }, [filteredHw]);

  const startVoiceInput = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
        onend: () => void;
        start: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
        onend: () => void;
        start: () => void;
      };
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'en-IN';
    setListening(true);
    rec.onresult = (ev) => {
      const transcript = ev.results[0][0].transcript;
      setTitle((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => setListening(false);
    rec.start();
  };

  const applyTemplate = (tplId: string) => {
    const tpl = workspace.templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setSubject(tpl.subject);
    setChapter(tpl.chapter);
    setTopic(tpl.topic);
    setTitle(tpl.title);
    setInstructions(tpl.instructions);
    setEstimatedMinutes(tpl.estimatedMinutes);
    setSource(tpl.source);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ids = targetStudents.length > 0 ? targetStudents : activeStudents.slice(0, 1).map((s) => s.id);
    if (saving) return;
    if (ids.length === 0 || title.trim().length < 2) {
      setAssignError('Choose a student and enter a homework title.');
      return;
    }
    setAssignError('');
    setSaving(true);
    try {
      await onCreateHomework({
        studentIds: ids,
        subject,
        chapter: chapter.trim(),
        topic: topic.trim(),
        title: title.trim(),
        instructions: instructions.trim(),
        dueDate,
        estimatedMinutes,
        priority,
        source,
        saveAsTemplate,
      });
      setTitle('');
      setInstructions('');
      setShowAddModal(false);
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : 'Unable to assign homework.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Homework & Study Tasks</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            One-tap Done / Partial / Needs Help · Duplicate-safe carry-forward · Reusable templates
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={carrying}
            onClick={async () => {
              setCarrying(true);
              setActionError('');
              try {
                const count = await onCarryForward();
                setCarryNotice(count ? `Moved ${count} unfinished task${count === 1 ? '' : 's'} to tomorrow.` : 'No unfinished tasks to move.');
              } catch (error) {
                setActionError(error instanceof Error ? error.message : 'Unable to carry homework forward.');
              } finally {
                setCarrying(false);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border border-sky-200 dark:border-white/20 bg-white/80 dark:bg-neutral-950 text-slate-800 dark:text-white whitespace-nowrap"
          >
            <Forward className="w-4 h-4" />
            <span>{carrying ? 'Moving tasks…' : 'Carry Forward Incomplete'}</span>
          </button>
          <button
            type="button"
            disabled={!activeStudents.length}
            onClick={() => {
              setAssignError('');
              setTargetStudents(activeStudents[0] ? [activeStudents[0].id] : []);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold glass-primary text-white whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Homework</span>
          </button>
        </div>
      </div>

      {actionError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{actionError}</p>}

      {carryNotice && (
        <div className="liquid-glass rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-slate-800 dark:text-white">
          <span>{carryNotice}</span>
          <button type="button" onClick={() => setCarryNotice(null)} aria-label="Dismiss notice">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center p-1 rounded-xl liquid-glass gap-1">
          {(['pending', 'completed', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                filterStatus === st
                  ? 'glass-primary text-white'
                  : 'text-slate-600 dark:text-neutral-400'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <select
          aria-label="Filter homework by student"
          value={filterStudent}
          onChange={(e) => setFilterStudent(e.target.value)}
          className="px-3 py-2 rounded-xl liquid-glass text-xs text-slate-800 dark:text-white"
        >
          <option value="all">All Students</option>
          {activeStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nickname ? `${s.nickname} (${s.fullName})` : s.fullName} (Class {s.classLevel} {s.board})
            </option>
          ))}
        </select>
      </div>

      {/* Student-grouped Homework Lists */}
      {groupedByStudent.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-10 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-neutral-300">
            No {filterStatus === 'pending' ? 'pending' : ''} homework tasks here.
          </p>
          <p className="text-xs text-slate-500 dark:text-neutral-400">
            Use Assign Homework to add tasks for one student or bulk-assign to an entire class.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByStudent.map(([studentId, items]) => {
            const stu = studentMap.get(studentId);
            return (
              <section key={studentId} className="liquid-glass rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-950 dark:text-white">
                      <StudentName student={stu} />
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-neutral-400">
                      {stu ? `Class ${stu.classLevel} · ${stu.board}` : ''} · {items.length} task{items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-sky-100/80 dark:divide-white/10">
                  {items.map((hw) => {
                    const isDone = hw.status === 'completed' || hw.status === 'verified';
                    return (
                      <div key={hw.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <p className={`text-sm font-semibold ${isDone ? 'line-through text-slate-400 dark:text-neutral-500' : 'text-slate-900 dark:text-white'}`}>
                            {hw.subject} — {hw.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">
                            {hw.topic || hw.chapter || hw.source} · Due {hw.dueDate} · {hw.estimatedMinutes} min · {hw.completionPct}%
                            {hw.needsHelp ? ' · Needs Teacher Help' : ''}
                            {hw.status === 'carried_forward' ? ' · Carried Forward' : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onUpdateHomework(hw.id, { status: 'completed', completionPct: 100, teacherVerified: true, needsHelp: false })}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                              isDone
                                ? 'bg-emerald-600 text-white dark:bg-white dark:text-black'
                                : 'border border-sky-200 dark:border-white/20 text-slate-800 dark:text-white hover:bg-sky-50 dark:hover:bg-white/10'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" /> Done
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateHomework(hw.id, { status: 'partial', completionPct: 50 })}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                              hw.status === 'partial'
                                ? 'bg-amber-600 text-white dark:bg-neutral-300 dark:text-black'
                                : 'border border-sky-200 dark:border-white/20 text-slate-700 dark:text-neutral-300'
                            }`}
                          >
                            Partial
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateHomework(hw.id, { status: 'not_started', completionPct: 0 })}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-sky-200 dark:border-white/20 text-slate-700 dark:text-neutral-300"
                          >
                            Not Done
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateHomework(hw.id, { needsHelp: !hw.needsHelp })}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                              hw.needsHelp
                                ? 'bg-rose-600 text-white dark:bg-neutral-700 dark:text-white'
                                : 'border border-sky-200 dark:border-white/20 text-slate-700 dark:text-neutral-300'
                            }`}
                          >
                            <HelpCircle className="w-3.5 h-3.5" /> Needs Help
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete homework ${hw.title}`}
                            onClick={async () => {
                              if (!window.confirm(`Delete “${hw.title}”?`)) return;
                              setActionError('');
                              try { await onDeleteHomework(hw.id); }
                              catch (error) { setActionError(error instanceof Error ? error.message : 'Unable to delete homework.'); }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-white"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Assign Homework Modal (Multi-Student, Templates & Voice-to-Text) */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Assign Homework"
        >
          <form onSubmit={handleAssignSubmit} className="glass-dialog-panel liquid-glass-strong w-full max-w-xl rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">Assign Homework</h2>
              <button type="button" disabled={saving} onClick={() => setShowAddModal(false)} aria-label="Close homework modal" className="p-2 rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>

            {workspace.templates.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-neutral-400 mb-1">
                  Quick Fill from Template
                </label>
                <select
                  defaultValue=""
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Choose a reusable template (optional)...</option>
                  {workspace.templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.subject}: {t.title} ({t.estimatedMinutes}m)</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-neutral-300">Assign to Student(s)</span>
                <button
                  type="button"
                  onClick={() => setTargetStudents(activeStudents.map((s) => s.id))}
                  className="text-xs font-semibold text-sky-700 dark:text-white hover:underline"
                >
                  Select All Active
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {activeStudents.map((s) => {
                  const selected = targetStudents.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setTargetStudents((prev) =>
                          prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                        )
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                        selected
                          ? 'glass-primary text-white border-sky-600 dark:border-white'
                          : 'bg-white/70 dark:bg-black border-sky-200 dark:border-white/15 text-slate-700 dark:text-neutral-300'
                      }`}
                    >
                      {s.nickname ? `${s.nickname} (${s.fullName})` : s.fullName} (C{s.classLevel})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
                >
                  {workspace.settings.subjects.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Topic / Concept</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Fractions, Photosynthesis"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="hw-title" className="text-xs font-medium text-slate-700 dark:text-neutral-300">
                  Homework Title *
                </label>
                <button
                  type="button"
                  onClick={startVoiceInput}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-white"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{listening ? 'Listening...' : 'Voice Dictate'}</span>
                </button>
              </div>
              <input
                id="hw-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Exercise 5.2, Questions 1–10"
                className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Est. Minutes</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as HomeworkSource)}
                  className="w-full px-2.5 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-xs text-slate-900 dark:text-white"
                >
                  <option value="tuition">Tuition</option>
                  <option value="school">School</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-xs text-slate-900 dark:text-white"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-neutral-300 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  />
                  <span>Save as reusable template</span>
                </label>
              </div>
            </div>

            {assignError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{assignError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-sky-200 dark:border-white/20"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-semibold glass-primary text-white"
              >
                {saving ? 'Assigning...' : 'Assign Task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// --- EXAMS VIEW ---

interface ExamsViewProps {
  workspace: WorkspaceSnapshot;
  onCreateExam: (payload: Record<string, unknown>) => Promise<void>;
  onUpdateExam: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDeleteExam: (id: string) => Promise<void>;
}

interface ExamEditProps {
  exam: ExamItem;
  onUpdate: ExamsViewProps['onUpdateExam'];
}

function ExamProgress({ exam, onUpdate }: ExamEditProps) {
  const [value, setValue] = useState(exam.preparationStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try { await onUpdate(exam.id, { preparationStatus: value }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to save preparation progress.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-1">
      <label className="flex items-center justify-between text-xs" htmlFor={`progress-${exam.id}`}>
        <span className="text-slate-600 dark:text-neutral-300">Preparation progress</span>
        <span className="tabular-nums font-semibold">{value}%</span>
      </label>
      <div className="flex min-h-9 items-center gap-3">
        <input id={`progress-${exam.id}`} type="range" min={0} max={100} step={5} value={value}
          aria-label={`Preparation progress for ${exam.examName}`} disabled={saving}
          onChange={(event) => setValue(Number(event.target.value))} className="w-full min-w-0" />
        {value !== exam.preparationStatus && (
          <button type="button" onClick={save} disabled={saving} className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-semibold text-sky-700 dark:text-sky-300">
            {saving ? 'Saving…' : 'Save progress'}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-left text-sm text-rose-700 dark:text-rose-200">{error}</p>}
    </div>
  );
}

function ExamMarksForm({ exam, onUpdate, onClose }: ExamEditProps & { onClose: () => void }) {
  const [value, setValue] = useState(exam.obtainedMarks?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const marks = Number(value);
    if (!value.trim() || !Number.isFinite(marks) || marks < 0 || marks > exam.maxMarks) {
      setError(`Enter a score between 0 and ${exam.maxMarks}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onUpdate(exam.id, { obtainedMarks: marks, preparationStatus: 100 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save marks.');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-2 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" inputMode="decimal" min={0} max={exam.maxMarks} step="any" required value={value}
          onChange={(event) => setValue(event.target.value)} aria-label={`Marks out of ${exam.maxMarks}`}
          placeholder={`Out of ${exam.maxMarks}`} className="min-h-10 min-w-24 flex-1 rounded-lg border border-sky-200 bg-white/85 px-2 text-sm dark:bg-neutral-950 dark:border-white/20" />
        <button type="submit" disabled={saving} className="glass-primary min-h-10 rounded-lg px-3 text-xs font-semibold">
          {saving ? 'Saving…' : 'Save marks'}
        </button>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Cancel marks entry" className="grid size-10 place-items-center rounded-lg border border-sky-200 dark:border-white/20">
          <X className="size-4" />
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{error}</p>}
    </form>
  );
}

export const ExamsView: React.FC<ExamsViewProps> = ({
  workspace,
  onCreateExam,
  onUpdateExam,
  onDeleteExam,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);
  const [savingExam, setSavingExam] = useState(false);
  const [examError, setExamError] = useState('');
  const [removeError, setRemoveError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const [studentId, setStudentId] = useState(workspace.students.find((s) => s.status === 'active')?.id ?? '');
  const [subject, setSubject] = useState('Mathematics');
  const [examName, setExamName] = useState('');
  const [examType, setExamType] = useState<ExamType>('unit_test');
  const [examDate, setExamDate] = useState(addDaysToDateStr(workspace.todayIst, 3));
  const [syllabus, setSyllabus] = useState('');
  const [maxMarks, setMaxMarks] = useState(40);
  const [revisionPlan, setRevisionPlan] = useState('');
  const [marksEntryId, setMarksEntryId] = useState<string | null>(null);
  const activeStudents = workspace.students.filter((student) => student.status === 'active');
  const subjects = workspace.settings.subjects.length ? workspace.settings.subjects : ['General'];

  useEffect(() => {
    if (showAdd && !dialog.current?.open) dialog.current?.showModal();
  }, [showAdd]);

  const studentMap = useMemo(() => new Map(workspace.students.map((s) => [s.id, s])), [workspace.students]);

  const upcoming = useMemo(
    () =>
      workspace.exams
        .filter((e) => e.obtainedMarks == null)
        .map((e) => ({ ...e, daysUntil: diffDaysBetweenDateStrs(workspace.todayIst, e.examDate) }))
        .sort((a, b) => a.daysUntil - b.daysUntil),
    [workspace.exams, workspace.todayIst],
  );

  const completed = useMemo(
    () => workspace.exams.filter((e) => e.obtainedMarks != null).sort((a, b) => b.examDate.localeCompare(a.examDate)),
    [workspace.exams],
  );

  const openExam = (exam?: ExamItem) => {
    setEditingExam(exam ?? null);
    setStudentId(exam?.studentId ?? activeStudents[0]?.id ?? '');
    setSubject(exam?.subject ?? subjects[0]);
    setExamName(exam?.examName ?? '');
    setExamType(exam?.examType ?? 'unit_test');
    setExamDate(exam?.examDate ?? addDaysToDateStr(workspace.todayIst, 3));
    setSyllabus(exam?.syllabus ?? '');
    setMaxMarks(exam?.maxMarks ?? 40);
    setRevisionPlan(exam?.revisionPlan ?? '');
    setExamError('');
    setShowAdd(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingExam) return;
    if (!studentId || examName.trim().length < 2) {
      setExamError('Choose a student and enter an exam name of at least two characters.');
      return;
    }
    setSavingExam(true);
    setExamError('');
    const details = { subject, examName: examName.trim(), examType, examDate, syllabus: syllabus.trim(), maxMarks, revisionPlan: revisionPlan.trim() };
    try {
      if (editingExam) await onUpdateExam(editingExam.id, details);
      else await onCreateExam({ ...details, studentId, preparationStatus: 0 });
      setShowAdd(false);
    } catch (error) {
      setExamError(error instanceof Error ? error.message : 'Unable to save the exam.');
    } finally {
      setSavingExam(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Examinations & Revision</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Exams within 1–3 days auto-escalate in today’s 6:00–8:00 PM schedule · Track marks & subject mastery
          </p>
        </div>
        <button
          type="button"
          disabled={!activeStudents.length}
          onClick={() => openExam()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold glass-primary text-white whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Add Examination</span>
        </button>
      </div>
      {!activeStudents.length && <p className="text-sm text-slate-600 dark:text-neutral-300">Add an active student before scheduling an exam.</p>}
      {removeError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{removeError}</p>}

      {/* Upcoming Exams */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">
          Upcoming Exams ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <div className="liquid-glass rounded-3xl p-8 text-center text-sm text-slate-500 dark:text-neutral-400">
            No upcoming exams scheduled. Add upcoming school tests or tuition revision tests to auto-plan revision.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {upcoming.map((ex) => {
              const stu = studentMap.get(ex.studentId);
              const urgent = ex.daysUntil >= 0 && ex.daysUntil <= 1;
              return (
                <div key={ex.id} className="liquid-glass rounded-3xl p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono font-semibold text-sky-700 dark:text-neutral-300">
                        {ex.daysUntil < 0
                          ? `Date passed (${ex.examDate}) — Enter Marks`
                          : ex.daysUntil === 0
                            ? 'TODAY'
                            : ex.daysUntil === 1
                              ? 'TOMORROW — High Priority'
                              : `In ${ex.daysUntil} days · ${ex.examDate}`}
                      </p>
                      <h3 className="text-base font-bold text-slate-950 dark:text-white mt-0.5">
                        <StudentName student={stu} />
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-neutral-400">
                        {ex.subject} · {ex.examName} · Max {ex.maxMarks} marks{urgent ? ' · Auto-prioritized today' : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => openExam(ex)} aria-label={`Edit exam ${ex.examName}`} className="p-2 text-sky-700 dark:text-sky-300">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Delete “${ex.examName}”?`)) return;
                          setRemoveError('');
                          try { await onDeleteExam(ex.id); }
                          catch (error) { setRemoveError(error instanceof Error ? error.message : 'Unable to delete the exam.'); }
                        }}
                        aria-label={`Delete exam ${ex.examName}`}
                        className="p-2 text-slate-500 hover:text-rose-600 dark:hover:text-rose-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {ex.syllabus && (
                    <p className="text-xs text-slate-700 dark:text-neutral-300">
                      <strong>Syllabus:</strong> {ex.syllabus}
                    </p>
                  )}
                  {ex.revisionPlan && (
                    <p className="text-xs text-slate-600 dark:text-neutral-400">
                      <strong>Revision Plan:</strong> {ex.revisionPlan}
                    </p>
                  )}

                  <ExamProgress key={`${ex.id}:${ex.preparationStatus}`} exam={ex} onUpdate={onUpdateExam} />

                  <div className="flex items-center justify-between pt-2 border-t border-sky-100 dark:border-white/15">
                    {marksEntryId === ex.id ? (
                      <ExamMarksForm exam={ex} onUpdate={onUpdateExam} onClose={() => setMarksEntryId(null)} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMarksEntryId(ex.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-white hover:underline"
                      >
                        <GraduationCap className="w-4 h-4" />
                        <span>Record Marks</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Completed Exam Results */}
      <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4 overflow-x-auto">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">Results & Performance History</h2>
        {completed.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-neutral-400">Recorded marks and percentages will appear here.</p>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-sky-100 dark:border-white/15 text-xs text-slate-500 dark:text-neutral-400">
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 px-3 font-medium">Exam & Subject</th>
                <th className="py-2 px-3 font-medium">Date</th>
                <th className="py-2 pl-3 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70 dark:divide-white/10">
              {completed.map((ex) => {
                const stu = studentMap.get(ex.studentId);
                const pct = ex.obtainedMarks != null ? Math.round((ex.obtainedMarks / ex.maxMarks) * 100) : 0;
                return (
                  <tr key={ex.id}>
                    <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white"><StudentName student={stu} /></td>
                    <td className="py-3 px-3 text-xs text-slate-700 dark:text-neutral-300">
                      {ex.subject} · {ex.examName}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-500 dark:text-neutral-400">{ex.examDate}</td>
                    <td className="py-3 pl-3 text-right font-mono tabular-nums text-xs font-bold text-slate-950 dark:text-white">
                      {marksEntryId === ex.id ? (
                        <ExamMarksForm exam={ex} onUpdate={onUpdateExam} onClose={() => setMarksEntryId(null)} />
                      ) : (
                        <button type="button" onClick={() => setMarksEntryId(ex.id)} aria-label={`Edit marks for ${ex.examName}`} className="inline-flex items-center gap-1.5 min-h-9 hover:underline">
                          {ex.obtainedMarks}/{ex.maxMarks} ({pct}%) <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {showAdd && (
        <dialog
          ref={dialog}
          className="glass-dialog-panel liquid-glass-strong m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl text-slate-950 dark:text-white"
          aria-labelledby="exam-dialog-title"
          onCancel={(event) => { event.preventDefault(); if (!savingExam) setShowAdd(false); }}
        >
          <form onSubmit={handleSaveExam} className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="exam-dialog-title" className="text-lg font-bold">{editingExam ? 'Edit Examination' : 'Schedule Examination'}</h2>
              <button type="button" disabled={savingExam} onClick={() => setShowAdd(false)} aria-label="Close exam modal" className="p-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="exam-student" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Student</label>
                <select
                  id="exam-student"
                  disabled={Boolean(editingExam)}
                  required
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
                >
                  {(editingExam ? workspace.students.filter((s) => s.id === studentId) : activeStudents).map((s) => (
                    <option key={s.id} value={s.id}>{s.nickname ? `${s.nickname} (${s.fullName})` : s.fullName} (Class {s.classLevel})</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="exam-subject" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Subject</label>
                <select
                  id="exam-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
                >
                  {!subjects.includes(subject) && <option value={subject}>{subject}</option>}
                  {subjects.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="exam-name" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Exam Name</label>
                <input
                  id="exam-name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="e.g. Unit Test 2 — Quadratic Equations"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="exam-date" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Exam Date</label>
                <input
                  id="exam-date"
                  type="date"
                  required
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="exam-max" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Max Marks</label>
                <input
                  id="exam-max"
                  type="number"
                  required
                  min={1}
                  max={500}
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="exam-type" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Exam Type</label>
                <select
                  id="exam-type"
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as ExamType)}
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-xs text-slate-900 dark:text-white"
                >
                  <option value="unit_test">Unit Test</option>
                  <option value="school_exam">School Exam</option>
                  <option value="weekly_test">Weekly Test</option>
                  <option value="revision_test">Revision Test</option>
                  <option value="tuition_test">Tuition Test</option>
                </select>
              </div>
              <div>
                <label htmlFor="exam-revision" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Revision Plan</label>
                <input
                  id="exam-revision"
                  maxLength={500}
                  value={revisionPlan}
                  onChange={(e) => setRevisionPlan(e.target.value)}
                  placeholder="20 min daily practice"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="exam-syllabus" className="block text-xs font-medium text-slate-700 dark:text-neutral-300 mb-1">Syllabus / Chapters</label>
                <input
                  id="exam-syllabus"
                  maxLength={400}
                  value={syllabus}
                  onChange={(e) => setSyllabus(e.target.value)}
                  placeholder="Chapters 4, 5 & key diagrams"
                  className="w-full px-3 py-2 rounded-xl bg-white/80 dark:bg-black border border-sky-200 dark:border-white/20 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
            {examError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-200">{examError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={savingExam} onClick={() => setShowAdd(false)} className="min-h-11 px-4 py-2 rounded-xl text-xs border border-sky-200 dark:border-white/20">Cancel</button>
              <button type="submit" disabled={savingExam} className="glass-primary min-h-11 px-5 py-2 rounded-xl text-sm font-semibold">{savingExam ? 'Saving…' : 'Save Exam'}</button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
};
