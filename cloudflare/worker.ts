import { billingMonthSchema, feeReminderStatements, invoiceAdjustment, invoicePatchSchema, mapBillingInvoice, monthlyBillStatements, paymentReceiptColumns, paymentSchema, paymentStatements, type BillingStatement, type PaymentReceipt } from '../server/billing';
// Cloudflare Worker Entrypoint — Complete Edge Runtime with D1 + Static Assets + Cron Triggers
import { getPushKeys, pushEndpointSchema, pushSubscriptionSchema, sendFeePush } from './webPush';
import { studentCreateSchema, studentPatchSchema } from '../server/studentPayload';
import type {
  AttendanceRecord,
  AuditLogEntry,
  DailyProgressLog,
  DiscountRule,
  ExamItem,
  FeePayment,
  HomeworkItem,
  HomeworkTemplate,
  NotificationItem,
  Student,
  TuitionSettings,
  WorkspaceSnapshot,
  BoardType,
  ClassLevel,
} from '../src/types';
import {
  buildNextDayFeeReminders,
  getInvoicePaymentDueDate,
  invoiceBalance,
} from '../src/engines/feeEngine';
import { buildCarryForwardHomeworkDrafts } from '../src/engines/schedulerEngine';
import { addDaysToDateStr, formatIstDate, formatIstMonthKey, formatRupeesFromPaise } from '../src/engines/istDate';
import { buildDemoDataset, createDefaultSettings, createDefaultTemplates } from '../server/demoSeed';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SESSION_SECRET?: string;
  TEACHER_ADMIN_PASSCODE?: string;
}

interface D1WriteResult { success: boolean; meta?: { changes?: number }; }

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1WriteResult>;
}

export interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1WriteResult[]>;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

// Helper: Hex / Bytes utilities
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const keyBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return { hash: bytesToHex(new Uint8Array(keyBits)), salt: bytesToHex(salt) };
}

async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const { hash } = await hashPassword(password, storedSalt);
  return hash === storedHash;
}

function generateId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `${prefix}-${bytesToHex(bytes)}`;
}

// Cookie helpers
function parseCookies(cookieHeader?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function extractToken(request: Request): string {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(request.headers.get('cookie'));
  return cookies.tuitio_session || '';
}

function makeSessionCookie(token: string, maxAgeSeconds: number): string {
  return [
    `tuitio_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
    'SameSite=Lax',
    'Secure',
  ].join('; ');
}

// JSON response helper with CORS headers
function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      ...headers,
    },
  });
}

function errorResponse(error: string, status = 400): Response {
  return jsonResponse({ error }, status);
}

// D1 Database operations
async function getTeacherCount(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) as c FROM teachers').bind().first<{ c: number }>();
  return row?.c ?? 0;
}

async function getSessionTeacher(db: D1Database, rawToken: string): Promise<{ id: string; email: string; name: string } | null> {
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const row = await db
    .prepare(
      `SELECT t.id, t.email, t.name, s.expires_at
       FROM sessions s
       JOIN teachers t ON t.id = s.teacher_id
       WHERE s.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ id: string; email: string; name: string; expires_at: string }>();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }
  return { id: row.id, email: row.email, name: row.name };
}

async function createSession(db: D1Database, teacherId: string): Promise<{ token: string; expiresAt: string }> {
  const rawToken = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
  await db
    .prepare('INSERT INTO sessions (token_hash, teacher_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(tokenHash, teacherId, expiresAt, new Date().toISOString())
    .run();
  return { token: rawToken, expiresAt };
}

async function deleteSession(db: D1Database, rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = await sha256(rawToken);
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}

async function logAudit(db: D1Database, action: string, entityType: string, entityId: string, summary: string): Promise<void> {
  await db
    .prepare('INSERT INTO audit_logs (id, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(generateId('aud'), action, entityType, entityId, summary, new Date().toISOString())
    .run();
}

async function getSettings(db: D1Database): Promise<TuitionSettings> {
  const row = await db.prepare('SELECT settings_json FROM app_settings WHERE id = ?').bind('default').first<{ settings_json: string }>();
  if (!row) return createDefaultSettings();
  try {
    const parsed = JSON.parse(row.settings_json) as Partial<TuitionSettings>;
    const defaults = createDefaultSettings();
    return {
      ...defaults,
      ...parsed,
      feeConfig: { ...defaults.feeConfig, ...(parsed.feeConfig || {}) },
      reminders: { ...defaults.reminders, ...parsed.reminders, feeDaysBefore: 1 },
    };
  } catch {
    return createDefaultSettings();
  }
}

async function saveSettings(db: D1Database, settings: TuitionSettings): Promise<TuitionSettings> {
  const now = new Date().toISOString();
  await db
    .prepare(
      'INSERT INTO app_settings (id, settings_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at',
    )
    .bind('default', JSON.stringify(settings), now)
    .run();
  return settings;
}

async function ensureBootstrapDefaults(db: D1Database): Promise<void> {
  const row = await db.prepare('SELECT id FROM app_settings WHERE id = ?').bind('default').first<{ id: string }>();
  if (!row) {
    const def = createDefaultSettings();
    await db
      .prepare('INSERT INTO app_settings (id, settings_json, updated_at) VALUES (?, ?, ?)')
      .bind('default', JSON.stringify(def), new Date().toISOString())
      .run();
  }
  const tplCount = await db.prepare('SELECT COUNT(*) as c FROM homework_templates').bind().first<{ c: number }>();
  if (!tplCount || tplCount.c === 0) {
    for (const t of createDefaultTemplates()) {
      await db
        .prepare(
          'INSERT OR IGNORE INTO homework_templates (id, title, subject, chapter, topic, instructions, estimated_minutes, source, class_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(t.id, t.title, t.subject, t.chapter, t.topic, t.instructions, t.estimatedMinutes, t.source, t.classLevel ?? null)
        .run();
    }
  }
}

async function getBillingData(db: D1Database, today: string, forSchedule = false) {
  const studentRows = (await db.prepare('SELECT * FROM students ORDER BY class_level ASC, full_name ASC').bind().all<Record<string, unknown>>()).results;
  const students: Student[] = studentRows.map((r) => ({
    id: String(r.id),
    studentCode: String(r.student_code),
    fullName: String(r.full_name),
    nickname: r.nickname ? String(r.nickname) : undefined,
    avatarColor: String(r.avatar_color),
    classLevel: Number(r.class_level) as ClassLevel,
    board: String(r.board) as BoardType,
    schoolName: String(r.school_name ?? ''),
    admissionDate: String(r.admission_date),
    dateOfBirth: r.date_of_birth ? String(r.date_of_birth) : undefined,
    studentPhone: r.student_phone ? String(r.student_phone) : undefined,
    parentName: String(r.parent_name ?? ''),
    parentPhone: String(r.parent_phone ?? ''),
    emergencyContact: r.emergency_contact ? String(r.emergency_contact) : undefined,
    address: r.address ? String(r.address) : undefined,
    subjects: JSON.parse(String(r.subjects_json || '[]')),
    strengths: JSON.parse(String(r.strengths_json || '[]')),
    weaknesses: JSON.parse(String(r.weaknesses_json || '[]')),
    academicPerformance: Number(r.academic_performance ?? 75),
    preferredArrivalTime: String(r.preferred_arrival_time || '18:00'),
    allocatedSlot: String(r.allocated_slot || '18:00–20:00'),
    expectedDurationMinutes: Number(r.expected_duration_minutes ?? 120),
    regularDays: JSON.parse(String(r.regular_days_json || '[1,2,3,4,5,6]')),
    feeDueDay: Number(r.monthly_payment_day ?? r.fee_due_day ?? 5),
    feeOverride: r.fee_override_json ? JSON.parse(String(r.fee_override_json)) : null,
    creditBalancePaise: Number(r.credit_balance_paise ?? 0),
    notes: String(r.notes ?? ''),
    learningSpeed: String(r.learning_speed || 'steady') as Student['learningSpeed'],
    priority: String(r.priority || 'normal') as Student['priority'],
    academicGoals: String(r.academic_goals ?? ''),
    status: String(r.status || 'active') as Student['status'],
    discontinuedAt: r.discontinued_at ? String(r.discontinued_at) : null,
    isDemo: Number(r.is_demo) === 1,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));

  const discRows = (await db.prepare('SELECT * FROM discounts WHERE active = 1 ORDER BY created_at DESC').bind().all<Record<string, unknown>>()).results;
  const discounts: DiscountRule[] = discRows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    kind: String(r.kind) as DiscountRule['kind'],
    value: Number(r.value),
    scope: String(r.scope) as DiscountRule['scope'],
    studentId: r.student_id ? String(r.student_id) : undefined,
    classLevel: r.class_level != null ? (Number(r.class_level) as ClassLevel) : undefined,
    board: r.board ? (String(r.board) as BoardType) : undefined,
    startDate: r.start_date ? String(r.start_date) : undefined,
    endDate: r.end_date ? String(r.end_date) : undefined,
    active: Number(r.active) === 1,
    createdAt: String(r.created_at),
  }));

  const tomorrow = addDaysToDateStr(today, 1);
  const invoiceQuery = forSchedule
    ? db.prepare('SELECT * FROM fee_invoices WHERE month_key = ? OR due_date = ?').bind(today.slice(0, 7), tomorrow)
    : db.prepare('SELECT * FROM fee_invoices ORDER BY month_key DESC, due_date ASC');
  const invRows = (await invoiceQuery.all<Record<string, unknown>>()).results;
  const invoices = invRows.map((row) => mapBillingInvoice(row, today));

  return { students, discounts, invoices };
}

async function runBillingBatch(db: D1Database, statements: BillingStatement[]) {
  return db.batch(statements.map(({ sql, values }) => db.prepare(sql).bind(...values)));
}

async function ensureMonthlyBills(db: D1Database, billing: Awaited<ReturnType<typeof getBillingData>>, settings: TuitionSettings, month: string, today: string) {
  const pairs = monthlyBillStatements({ ...billing, settings, todayIst: today }, month, () => generateId('inv'), new Date().toISOString());
  let created = 0;
  for (let start = 0; start < pairs.length; start += 10) {
    const results = await runBillingBatch(db, pairs.slice(start, start + 10).flat());
    created += results.reduce((count, result, index) => count + (index % 2 === 0 ? result.meta?.changes ?? 0 : 0), 0);
  }
  return { created, attempted: pairs.length > 0 };
}

async function reconcileFeeAlerts(
  db: D1Database,
  billing: Awaited<ReturnType<typeof getBillingData>>,
  today: string,
): Promise<number> {
  const reminders = buildNextDayFeeReminders({ students: billing.students, invoices: billing.invoices, todayDate: today });
  const writes = feeReminderStatements(reminders, today, new Date().toISOString(), () => generateId('ntf'));
  await runBillingBatch(db, writes);
  return reminders.length;
}

async function getWorkspaceSnapshot(db: D1Database): Promise<WorkspaceSnapshot> {
  const nowTick = new Date();
  const todayIst = formatIstDate(nowTick);
  const currentMonthIst = formatIstMonthKey(nowTick);
  const settings = await getSettings(db);

  let billing = await getBillingData(db, todayIst);
  const generated = await ensureMonthlyBills(db, billing, settings, currentMonthIst, todayIst);
  if (generated.attempted) billing = await getBillingData(db, todayIst);
  const { students, discounts, invoices } = billing;
  const attRows = (await db.prepare('SELECT * FROM attendance ORDER BY date DESC, updated_at DESC LIMIT 500').bind().all<Record<string, unknown>>()).results;
  const attendance: AttendanceRecord[] = attRows.map((r) => ({
    id: String(r.id),
    studentId: String(r.student_id),
    date: String(r.date),
    status: String(r.status) as AttendanceRecord['status'],
    actualArrivalTime: r.actual_arrival_time ? String(r.actual_arrival_time) : null,
    departureTime: r.departure_time ? String(r.departure_time) : null,
    note: String(r.note ?? ''),
    isDemo: Number(r.is_demo) === 1,
    updatedAt: String(r.updated_at),
  }));

  const hwRows = (await db.prepare('SELECT * FROM homework ORDER BY due_date ASC, updated_at DESC').bind().all<Record<string, unknown>>()).results;
  const homework: HomeworkItem[] = hwRows.map((r) => ({
    id: String(r.id),
    studentId: String(r.student_id),
    subject: String(r.subject),
    chapter: String(r.chapter ?? ''),
    topic: String(r.topic ?? ''),
    title: String(r.title),
    instructions: String(r.instructions ?? ''),
    assignedDate: String(r.assigned_date),
    dueDate: String(r.due_date),
    estimatedMinutes: Number(r.estimated_minutes ?? 20),
    priority: String(r.priority || 'normal') as HomeworkItem['priority'],
    source: String(r.source || 'tuition') as HomeworkItem['source'],
    completionPct: Number(r.completion_pct ?? 0),
    status: String(r.status || 'not_started') as HomeworkItem['status'],
    completedDate: r.completed_date ? String(r.completed_date) : null,
    teacherVerified: Number(r.teacher_verified) === 1,
    needsHelp: Number(r.needs_help) === 1,
    remarks: String(r.remarks ?? ''),
    carriedFromId: r.carried_from_id ? String(r.carried_from_id) : null,
    isDemo: Number(r.is_demo) === 1,
    updatedAt: String(r.updated_at),
  }));

  const tplRows = (await db.prepare('SELECT * FROM homework_templates ORDER BY title ASC').bind().all<Record<string, unknown>>()).results;
  const templates: HomeworkTemplate[] = tplRows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    subject: String(r.subject),
    chapter: String(r.chapter ?? ''),
    topic: String(r.topic ?? ''),
    instructions: String(r.instructions ?? ''),
    estimatedMinutes: Number(r.estimated_minutes ?? 20),
    source: String(r.source || 'tuition') as HomeworkTemplate['source'],
    classLevel: r.class_level != null ? (Number(r.class_level) as HomeworkTemplate['classLevel']) : null,
  }));

  const examRows = (await db.prepare('SELECT * FROM exams ORDER BY exam_date ASC').bind().all<Record<string, unknown>>()).results;
  const exams: ExamItem[] = examRows.map((r) => ({
    id: String(r.id),
    studentId: String(r.student_id),
    subject: String(r.subject),
    examName: String(r.exam_name),
    examType: String(r.exam_type || 'unit_test') as ExamItem['examType'],
    examDate: String(r.exam_date),
    syllabus: String(r.syllabus ?? ''),
    maxMarks: Number(r.max_marks ?? 50),
    obtainedMarks: r.obtained_marks != null ? Number(r.obtained_marks) : null,
    importantChapters: JSON.parse(String(r.important_chapters_json || '[]')),
    preparationStatus: Number(r.preparation_status ?? 0),
    revisionPlan: String(r.revision_plan ?? ''),
    weakAreas: JSON.parse(String(r.weak_areas_json || '[]')),
    isDemo: Number(r.is_demo) === 1,
    updatedAt: String(r.updated_at),
  }));

  const payRows = (await db.prepare('SELECT * FROM fee_payments ORDER BY payment_date DESC, created_at DESC').bind().all<Record<string, unknown>>()).results;
  const payments: FeePayment[] = payRows.map((r) => ({
    id: String(r.id),
    invoiceId: r.invoice_id ? String(r.invoice_id) : null,
    studentId: String(r.student_id),
    amountPaise: Number(r.amount_paise),
    paymentDate: String(r.payment_date),
    method: String(r.method) as FeePayment['method'],
    transactionRef: String(r.transaction_ref ?? ''),
    receiptNumber: String(r.receipt_number),
    notes: String(r.notes ?? ''),
    isAdvance: Number(r.is_advance) === 1,
    allocations: r.allocations_json ? JSON.parse(String(r.allocations_json)) : undefined,
    isDemo: Number(r.is_demo) === 1,
    createdAt: String(r.created_at),
  }));

  const progRows = (await db.prepare('SELECT * FROM daily_progress ORDER BY date DESC').bind().all<Record<string, unknown>>()).results;
  const progressLogs: DailyProgressLog[] = progRows.map((r) => ({
    id: String(r.id),
    studentId: String(r.student_id),
    date: String(r.date),
    subjectsCovered: JSON.parse(String(r.subjects_covered_json || '[]')),
    topicsStudied: String(r.topics_studied ?? ''),
    homeworkCompletedCount: Number(r.homework_completed_count ?? 0),
    homeworkRemainingCount: Number(r.homework_remaining_count ?? 0),
    doubtsCleared: String(r.doubts_cleared ?? ''),
    teacherComment: String(r.teacher_comment ?? ''),
    improvementAreas: String(r.improvement_areas ?? ''),
    nextSessionTasks: String(r.next_session_tasks ?? ''),
    completionPct: Number(r.completion_pct ?? 0),
    isDemo: Number(r.is_demo) === 1,
    updatedAt: String(r.updated_at),
  }));

  await reconcileFeeAlerts(db, billing, todayIst);
  const notifRows = (await db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 80').bind().all<Record<string, unknown>>()).results;
  const notifications: NotificationItem[] = notifRows.map((r) => ({
    id: String(r.id),
    category: String(r.category) as NotificationItem['category'],
    title: String(r.title),
    message: String(r.message),
    studentId: r.student_id ? String(r.student_id) : null,
    priority: String(r.priority || 'normal') as NotificationItem['priority'],
    read: Number(r.read) === 1,
    dedupKey: String(r.dedup_key),
    scheduledFor: r.scheduled_for ? String(r.scheduled_for) : undefined,
    createdAt: String(r.created_at),
  }));

  const auditRows = (await db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 60').bind().all<Record<string, unknown>>()).results;
  const auditLogs: AuditLogEntry[] = auditRows.map((r) => ({
    id: String(r.id),
    action: String(r.action),
    entityType: String(r.entity_type),
    entityId: String(r.entity_id),
    summary: String(r.summary),
    createdAt: String(r.created_at),
  }));

  return {
    settings,
    students,
    discounts,
    attendance,
    homework,
    templates,
    exams,
    invoices,
    payments,
    progressLogs,
    notifications,
    auditLogs,
    todayIst,
    currentMonthIst,
    hasDemoData: students.some((s) => s.isDemo),
  };
}

async function seedDemoWorkspace(db: D1Database): Promise<void> {
  const existing = await db.prepare('SELECT COUNT(*) as c FROM students WHERE is_demo = 1').bind().first<{ c: number }>();
  if (existing && existing.c > 0) return;

  const data = buildDemoDataset(new Date());

  for (const s of data.students) {
    await db
      .prepare(`
        INSERT OR IGNORE INTO students (
          id, student_code, full_name, avatar_color, class_level, board, school_name,
          admission_date, date_of_birth, student_phone, parent_name, parent_phone,
          emergency_contact, address, subjects_json, strengths_json, weaknesses_json,
          academic_performance, preferred_arrival_time, allocated_slot, expected_duration_minutes,
          regular_days_json, fee_due_day, fee_override_json, credit_balance_paise, notes,
          learning_speed, priority, academic_goals, status, discontinued_at, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        s.id,
        s.studentCode,
        s.fullName,
        s.avatarColor,
        s.classLevel,
        s.board,
        s.schoolName,
        s.admissionDate,
        s.dateOfBirth ?? null,
        s.studentPhone ?? null,
        s.parentName,
        s.parentPhone,
        s.emergencyContact ?? null,
        s.address ?? null,
        JSON.stringify(s.subjects),
        JSON.stringify(s.strengths),
        JSON.stringify(s.weaknesses),
        s.academicPerformance,
        s.preferredArrivalTime,
        s.allocatedSlot,
        s.expectedDurationMinutes,
        JSON.stringify(s.regularDays),
        s.feeDueDay,
        s.feeOverride ? JSON.stringify(s.feeOverride) : null,
        s.creditBalancePaise,
        s.notes,
        s.learningSpeed,
        s.priority,
        s.academicGoals,
        s.status,
        s.discontinuedAt ?? null,
        1,
        s.createdAt,
        s.updatedAt,
      )
      .run();
  }

  for (const d of data.discounts) {
    await db
      .prepare(`
        INSERT OR IGNORE INTO discounts (id, name, kind, value, scope, student_id, class_level, board, start_date, end_date, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(d.id, d.name, d.kind, d.value, d.scope, d.studentId ?? null, d.classLevel ?? null, d.board ?? null, d.startDate ?? null, d.endDate ?? null, 1, d.createdAt)
      .run();
  }

  for (const a of data.attendance) {
    await db
      .prepare(`
        INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `)
      .bind(a.id, a.studentId, a.date, a.status, a.actualArrivalTime ?? null, a.departureTime ?? null, a.note ?? '', a.updatedAt)
      .run();
  }

  for (const h of data.homework) {
    await db
      .prepare(`
        INSERT OR IGNORE INTO homework (id, student_id, subject, chapter, topic, title, instructions, assigned_date, due_date, estimated_minutes, priority, source, completion_pct, status, completed_date, teacher_verified, needs_help, remarks, carried_from_id, is_demo, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `)
      .bind(h.id, h.studentId, h.subject, h.chapter, h.topic, h.title, h.instructions, h.assignedDate, h.dueDate, h.estimatedMinutes, h.priority, h.source, h.completionPct, h.status, h.completedDate ?? null, h.teacherVerified ? 1 : 0, h.needsHelp ? 1 : 0, h.remarks, h.carriedFromId ?? null, h.updatedAt)
      .run();
  }

  for (const e of data.exams) {
    await db
      .prepare(`
        INSERT OR IGNORE INTO exams (id, student_id, subject, exam_name, exam_type, exam_date, syllabus, max_marks, obtained_marks, important_chapters_json, preparation_status, revision_plan, weak_areas_json, is_demo, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `)
      .bind(e.id, e.studentId, e.subject, e.examName, e.examType, e.examDate, e.syllabus, e.maxMarks, e.obtainedMarks ?? null, JSON.stringify(e.importantChapters), e.preparationStatus, e.revisionPlan, JSON.stringify(e.weakAreas), e.updatedAt)
      .run();
  }

  for (const inv of data.invoices) {
    await db
      .prepare(`
        INSERT OR IGNORE INTO fee_invoices (id, student_id, month_key, class_level_snapshot, board_snapshot, base_amount_paise, board_surcharge_paise, override_applied, discount_paise, discount_summary, total_amount_paise, paid_amount_paise, due_date, status, notes, is_demo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `)
      .bind(inv.id, inv.studentId, inv.monthKey, inv.classLevelSnapshot, inv.boardSnapshot, inv.baseAmountPaise, inv.boardSurchargePaise, inv.overrideApplied ? 1 : 0, inv.discountPaise, inv.discountSummary, inv.totalAmountPaise, inv.paidAmountPaise, inv.dueDate, inv.status, inv.notes ?? '', inv.createdAt, inv.updatedAt)
      .run();
  }

  for (const p of data.payments) {
    await db
      .prepare(`
        INSERT OR IGNORE INTO fee_payments (id, invoice_id, student_id, amount_paise, payment_date, method, transaction_ref, receipt_number, notes, is_advance, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `)
      .bind(p.id, p.invoiceId ?? null, p.studentId, p.amountPaise, p.paymentDate, p.method, p.transactionRef, p.receiptNumber, p.notes, p.isAdvance ? 1 : 0, p.createdAt)
      .run();
  }
}

async function clearDemoWorkspace(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM fee_payments WHERE is_demo = 1').run();
  await db.prepare('DELETE FROM fee_invoices WHERE is_demo = 1').run();
  await db.prepare('DELETE FROM exams WHERE is_demo = 1').run();
  await db.prepare('DELETE FROM homework WHERE is_demo = 1').run();
  await db.prepare('DELETE FROM attendance WHERE is_demo = 1').run();
  await db.prepare('DELETE FROM daily_progress WHERE is_demo = 1').run();
  await db.prepare('DELETE FROM students WHERE is_demo = 1').run();
  await db.prepare("DELETE FROM notifications WHERE dedup_key LIKE 'demo-%'").run();
}

// Router
async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS preflight handling for web client
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Allow-Credentials': 'true',
        },
      });
    }

    // Health check endpoint
    if (url.pathname === '/api/health') {
      try {
        const check = await env.DB.prepare('SELECT 1 as ok').bind().first<{ ok: number }>();
        return jsonResponse({ status: 'ok', runtime: 'cloudflare-workers-d1', db: check?.ok === 1 });
      } catch (err: unknown) {
        return errorResponse(`D1 connection failed: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    // Only process /api/ routes in Worker logic; serve static assets for everything else
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    await ensureBootstrapDefaults(env.DB);

    // 1. Auth Status
    if (url.pathname === '/api/auth/status' && method === 'GET') {
      const token = extractToken(request);
      const teacher = await getSessionTeacher(env.DB, token);
      const count = await getTeacherCount(env.DB);
      return jsonResponse({
        initialized: count > 0,
        authenticated: Boolean(teacher),
        teacher,
        hasEnvPasscode: Boolean(env.TEACHER_ADMIN_PASSCODE?.trim()),
      });
    }

    // 2. Auth Setup
    if (url.pathname === '/api/auth/setup' && method === 'POST') {
      const count = await getTeacherCount(env.DB);
      if (count > 0) {
        return errorResponse('Workspace already claimed. Please sign in.', 400);
      }
      const body = (await request.json().catch(() => ({}))) as Record<string, string>;
      const { email, name, password, tuitionName, passcode } = body;
      if (!email || !name || !password) {
        return errorResponse('Email, name, and password are required.', 400);
      }
      if (env.TEACHER_ADMIN_PASSCODE?.trim() && passcode !== env.TEACHER_ADMIN_PASSCODE.trim()) {
        return errorResponse('Invalid administrative claim passcode.', 403);
      }

      const teacherId = generateId('tch');
      const now = new Date().toISOString();
      const { hash, salt } = await hashPassword(password);
      await env.DB
        .prepare('INSERT INTO teachers (id, email, name, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(teacherId, email.trim().toLowerCase(), name.trim(), hash, salt, now, now)
        .run();

      if (tuitionName?.trim()) {
        const settings = await getSettings(env.DB);
        settings.tuitionName = tuitionName.trim();
        settings.teacherName = name.trim();
        settings.contactEmail = email.trim();
        await saveSettings(env.DB, settings);
      }

      const session = await createSession(env.DB, teacherId);
      const cookie = makeSessionCookie(session.token, 60 * 60 * 24 * 14);
      return jsonResponse(
        { token: session.token, teacher: { id: teacherId, email: email.trim().toLowerCase(), name: name.trim() } },
        201,
        { 'Set-Cookie': cookie },
      );
    }

    // 3. Auth Demo Bootstrap
    if (url.pathname === '/api/auth/demo-bootstrap' && method === 'POST') {
      const teachers = (await env.DB.prepare('SELECT id, email, name FROM teachers LIMIT 2')
        .all<{ id: string; email: string; name: string }>()).results;
      const realStudent = await env.DB.prepare('SELECT id FROM students WHERE is_demo = 0 LIMIT 1').first();
      if (realStudent || teachers.some((teacher) => teacher.id !== 'demo-teacher')) {
        return errorResponse('Workspace is already claimed. Please sign in.', 403);
      }
      let teacherRow = teachers[0];
      if (!teacherRow) {
        const now = new Date().toISOString();
        const { hash, salt } = await hashPassword(crypto.randomUUID());
        await env.DB
          .prepare('INSERT INTO teachers (id, email, name, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind('demo-teacher', 'meera@tuitio.app', 'Meera Deshmukh', hash, salt, now, now)
          .run();
        teacherRow = { id: 'demo-teacher', email: 'meera@tuitio.app', name: 'Meera Deshmukh' };
      }
      await seedDemoWorkspace(env.DB);
      const session = await createSession(env.DB, teacherRow.id);
      const cookie = makeSessionCookie(session.token, 60 * 60 * 24 * 14);
      return jsonResponse({ token: session.token, teacher: teacherRow }, 201, { 'Set-Cookie': cookie });
    }

    // 4. Auth Login
    if (url.pathname === '/api/auth/login' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, string>;
      const { email, password, passcode } = body;
      if (!email || !password) return errorResponse('Email and password required.', 400);

      const teacher = await env.DB
        .prepare('SELECT id, email, name, password_hash, password_salt FROM teachers WHERE LOWER(email) = LOWER(?)')
        .bind(email.trim())
        .first<{ id: string; email: string; name: string; password_hash: string; password_salt: string }>();

      let valid = false;
      if (env.TEACHER_ADMIN_PASSCODE?.trim() && passcode === env.TEACHER_ADMIN_PASSCODE.trim()) {
        valid = true;
      } else if (teacher) {
        valid = await verifyPassword(password, teacher.password_hash, teacher.password_salt);
      }

      if (!valid || !teacher) {
        return errorResponse('Invalid email or password.', 401);
      }

      const session = await createSession(env.DB, teacher.id);
      const cookie = makeSessionCookie(session.token, 60 * 60 * 24 * 14);
      return jsonResponse(
        { token: session.token, teacher: { id: teacher.id, email: teacher.email, name: teacher.name } },
        200,
        { 'Set-Cookie': cookie },
      );
    }

    // 5. Auth Logout
    if (url.pathname === '/api/auth/logout' && method === 'POST') {
      const token = extractToken(request);
      await deleteSession(env.DB, token);
      const cookie = makeSessionCookie('', 0);
      return jsonResponse({ ok: true }, 200, { 'Set-Cookie': cookie });
    }

    // Authenticate Protected Routes
    const token = extractToken(request);
    const authedTeacher = await getSessionTeacher(env.DB, token);
    if (!authedTeacher) {
      return errorResponse('Authentication required.', 401);
    }

    // 6. Workspace Snapshot
    if (url.pathname === '/api/workspace' && method === 'GET') {
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse(snap);
    }

    // 7. Demo Data controls
    if (url.pathname === '/api/demo/seed' && method === 'POST') {
      await seedDemoWorkspace(env.DB);
      return jsonResponse(await getWorkspaceSnapshot(env.DB));
    }
    if (url.pathname === '/api/demo/clear' && method === 'POST') {
      await clearDemoWorkspace(env.DB);
      return jsonResponse(await getWorkspaceSnapshot(env.DB));
    }

    // 8. Students
    if (url.pathname === '/api/students' && method === 'POST') {
      const parsed = studentCreateSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return errorResponse(parsed.error.issues[0].message);
      const student = parsed.data;
      const id = generateId('stu');
      const now = new Date().toISOString();
      const admission = student.admissionDate ?? formatIstDate();
      const dueDay = student.feeDueDay ?? Number(admission.slice(8));

      await env.DB.prepare(`
        INSERT INTO students (
          id, student_code, full_name, nickname, avatar_color, class_level, board, school_name,
          admission_date, date_of_birth, student_phone, parent_name, parent_phone,
          emergency_contact, address, subjects_json, strengths_json, weaknesses_json,
          academic_performance, preferred_arrival_time, allocated_slot, expected_duration_minutes,
          regular_days_json, fee_due_day, monthly_payment_day, fee_override_json, notes,
          learning_speed, priority, academic_goals, created_at, updated_at
        )
        SELECT ?, printf('STU-%03d', COALESCE(MAX(CAST(substr(student_code, 5) AS INTEGER)), 100) + 1),
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM students WHERE student_code GLOB 'STU-[0-9]*' AND substr(student_code, 5) NOT GLOB '*[^0-9]*'
      `).bind(
        id, student.fullName, student.nickname || null, student.avatarColor ?? '#0284C7',
        student.classLevel, student.board, student.schoolName,
        admission, student.dateOfBirth ?? null,
        student.studentPhone ?? null, student.parentName, student.parentPhone,
        student.emergencyContact ?? null, student.address ?? null, JSON.stringify(student.subjects),
        JSON.stringify(student.strengths), JSON.stringify(student.weaknesses), student.academicPerformance,
        student.preferredArrivalTime, student.allocatedSlot, student.expectedDurationMinutes,
        JSON.stringify(student.regularDays), Math.min(dueDay, 28), dueDay,
        student.feeOverride ? JSON.stringify(student.feeOverride) : null, student.notes,
        student.learningSpeed, student.priority, student.academicGoals, now, now,
      ).run();

      await logAudit(env.DB, 'CREATE_STUDENT', 'student', id, `Enrolled student ${student.fullName} (Class ${student.classLevel} ${student.board})`);
      return jsonResponse({ id, snapshot: await getWorkspaceSnapshot(env.DB) }, 201);
    }

    const studentIdMatch = url.pathname.match(/^\/api\/students\/([^/]+)\/?$/);
    if (studentIdMatch && studentIdMatch[1] !== 'promote' && (method === 'PUT' || method === 'POST')) {
      const id = studentIdMatch[1];
      const parsed = studentPatchSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return errorResponse(parsed.error.issues[0].message);
      const student = parsed.data;
      const existing = await env.DB.prepare('SELECT full_name FROM students WHERE id = ?').bind(id).first<{ full_name: string }>();
      if (!existing) return errorResponse('Student not found.', 404);

      const now = new Date().toISOString();
      const statements = [env.DB.prepare(`
        UPDATE students SET
          full_name = COALESCE(?, full_name),
          nickname = CASE WHEN ? THEN ? ELSE nickname END,
          avatar_color = COALESCE(?, avatar_color),
          class_level = COALESCE(?, class_level),
          board = COALESCE(?, board),
          school_name = COALESCE(?, school_name),
          admission_date = COALESCE(?, admission_date),
          date_of_birth = COALESCE(?, date_of_birth),
          student_phone = COALESCE(?, student_phone),
          parent_name = COALESCE(?, parent_name),
          parent_phone = COALESCE(?, parent_phone),
          emergency_contact = COALESCE(?, emergency_contact),
          address = COALESCE(?, address),
          subjects_json = COALESCE(?, subjects_json),
          strengths_json = COALESCE(?, strengths_json),
          weaknesses_json = COALESCE(?, weaknesses_json),
          academic_performance = COALESCE(?, academic_performance),
          preferred_arrival_time = COALESCE(?, preferred_arrival_time),
          allocated_slot = COALESCE(?, allocated_slot),
          expected_duration_minutes = COALESCE(?, expected_duration_minutes),
          regular_days_json = COALESCE(?, regular_days_json),
          fee_due_day = COALESCE(?, fee_due_day),
          monthly_payment_day = COALESCE(?, monthly_payment_day),
          fee_override_json = CASE WHEN ? THEN ? ELSE fee_override_json END,
          notes = COALESCE(?, notes),
          learning_speed = COALESCE(?, learning_speed),
          priority = COALESCE(?, priority),
          academic_goals = COALESCE(?, academic_goals),
          updated_at = ?
        WHERE id = ?
      `).bind(
        student.fullName ?? null, Number(student.nickname !== undefined), student.nickname || null,
        student.avatarColor ?? null, student.classLevel ?? null, student.board ?? null, student.schoolName ?? null,
        student.admissionDate ?? null, student.dateOfBirth ?? null, student.studentPhone ?? null,
        student.parentName ?? null, student.parentPhone ?? null, student.emergencyContact ?? null, student.address ?? null,
        student.subjects ? JSON.stringify(student.subjects) : null,
        student.strengths ? JSON.stringify(student.strengths) : null,
        student.weaknesses ? JSON.stringify(student.weaknesses) : null, student.academicPerformance ?? null,
        student.preferredArrivalTime ?? null, student.allocatedSlot ?? null, student.expectedDurationMinutes ?? null,
        student.regularDays ? JSON.stringify(student.regularDays) : null,
        student.feeDueDay === undefined ? null : Math.min(student.feeDueDay, 28), student.feeDueDay ?? null,
        Number(student.feeOverride !== undefined), student.feeOverride ? JSON.stringify(student.feeOverride) : null,
        student.notes ?? null, student.learningSpeed ?? null, student.priority ?? null, student.academicGoals ?? null,
        now, id,
      )];
      if (student.feeDueDay !== undefined) {
        const today = formatIstDate();
        const invoices = (await env.DB.prepare(`
          SELECT id, month_key FROM fee_invoices
          WHERE student_id = ? AND substr(due_date, 1, 7) >= ? AND due_date_overridden = 0 AND status IN ('unpaid', 'partial', 'overdue')
        `).bind(id, today.slice(0, 7)).all<{ id: string; month_key: string }>()).results;
        for (const invoice of invoices) {
          const due = getInvoicePaymentDueDate(invoice.month_key, student.feeDueDay);
          statements.push(env.DB.prepare(`
            UPDATE fee_invoices
            SET due_date = ?, status = CASE
              WHEN total_amount_paise <= paid_amount_paise THEN 'paid'
              WHEN ? < ? THEN 'overdue'
              WHEN paid_amount_paise > 0 THEN 'partial'
              ELSE 'unpaid' END,
              updated_at = ?
            WHERE id = ? AND due_date <> ? AND due_date_overridden = 0 AND status IN ('unpaid', 'partial', 'overdue')
          `).bind(due, due, today, now, invoice.id, due));
        }
      }
      await env.DB.batch(statements);

      await logAudit(env.DB, 'UPDATE_STUDENT', 'student', id, `Updated student profile for ${student.fullName ?? existing.full_name}`);
      return jsonResponse({ snapshot: await getWorkspaceSnapshot(env.DB) });
    }

    const studentStatusMatch = url.pathname.match(/^\/api\/students\/([^/]+)\/status$/);
    if (studentStatusMatch && method === 'POST') {
      const id = studentStatusMatch[1];
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const status = String(body.status || 'active');
      const now = new Date().toISOString();
      const discAt = status === 'discontinued' ? formatIstDate(new Date()) : null;
      await env.DB
        .prepare('UPDATE students SET status = ?, discontinued_at = ?, updated_at = ? WHERE id = ?')
        .bind(status, discAt, now, id)
        .run();
      await logAudit(env.DB, 'CHANGE_STATUS', 'student', id, `Updated status to ${status}`);
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    if (studentIdMatch && method === 'DELETE') {
      const id = studentIdMatch[1];
      await env.DB.prepare('DELETE FROM students WHERE id = ?').bind(id).run();
      await logAudit(env.DB, 'PERMANENT_DELETE', 'student', id, 'Deleted student permanently');
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    if (url.pathname === '/api/students/promote' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
      const overridePolicy = String(body.overridePolicy || 'adopt_class_rate');
      const targetBoard = body.targetBoard ? String(body.targetBoard) : undefined;
      const now = new Date().toISOString();
      let promoted = 0;
      let graduated = 0;

      for (const sid of studentIds) {
        const row = await env.DB.prepare('SELECT id, full_name, class_level, board, fee_override_json FROM students WHERE id = ?').bind(sid).first<{ id: string; full_name: string; class_level: number; board: string; fee_override_json: string | null }>();
        if (!row) continue;

        if (row.class_level >= 10) {
          await env.DB.prepare('UPDATE students SET status = ?, updated_at = ? WHERE id = ?').bind('graduated', now, sid).run();
          graduated += 1;
        } else {
          const nextClass = row.class_level + 1;
          const nextBoard = targetBoard ?? row.board;
          const nextOverride = overridePolicy === 'keep_override' ? row.fee_override_json : null;
          await env.DB.prepare('UPDATE students SET class_level = ?, board = ?, fee_override_json = ?, updated_at = ? WHERE id = ?').bind(nextClass, nextBoard, nextOverride, now, sid).run();
          promoted += 1;
        }
      }
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ promoted, graduated, snapshot: snap, ...snap });
    }

    // 9. Attendance
    if (url.pathname === '/api/attendance' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const { studentId, date, status, actualArrivalTime, departureTime, note } = body;
      const now = new Date().toISOString();
      const existing = await env.DB.prepare('SELECT id FROM attendance WHERE student_id = ? AND date = ?').bind(studentId, date).first<{ id: string }>();

      if (existing) {
        await env.DB
          .prepare('UPDATE attendance SET status = ?, actual_arrival_time = ?, departure_time = ?, note = ?, updated_at = ? WHERE id = ?')
          .bind(status, actualArrivalTime ?? null, departureTime ?? null, note ?? '', now, existing.id)
          .run();
      } else {
        await env.DB
          .prepare('INSERT INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)')
          .bind(generateId('att'), studentId, date, status, actualArrivalTime ?? null, departureTime ?? null, note ?? '', now)
          .run();
      }
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    if (url.pathname === '/api/attendance/bulk' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const date = String(body.date || formatIstDate(new Date()));
      const entries = Array.isArray(body.entries) ? body.entries : [];
      const now = new Date().toISOString();

      for (const e of entries) {
        const existing = await env.DB.prepare('SELECT id FROM attendance WHERE student_id = ? AND date = ?').bind(e.studentId, date).first<{ id: string }>();
        if (existing) {
          await env.DB.prepare('UPDATE attendance SET status = ?, actual_arrival_time = ?, note = ?, updated_at = ? WHERE id = ?').bind(e.status, e.actualArrivalTime ?? null, e.note ?? '', now, existing.id).run();
        } else {
          await env.DB.prepare('INSERT INTO attendance (id, student_id, date, status, actual_arrival_time, note, is_demo, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)').bind(generateId('att'), e.studentId, date, e.status, e.actualArrivalTime ?? null, e.note ?? '', now).run();
        }
      }
      await logAudit(env.DB, 'BULK_ATTENDANCE', 'attendance', date, `Marked attendance for ${entries.length} students`);
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    // 10. Homework
    if (url.pathname === '/api/homework' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const now = new Date().toISOString();
      const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [body.studentId];

      for (const sId of studentIds) {
        await env.DB
          .prepare(`
            INSERT INTO homework (
              id, student_id, subject, chapter, topic, title, instructions, assigned_date, due_date,
              estimated_minutes, priority, source, completion_pct, status, completed_date, teacher_verified,
              needs_help, remarks, carried_from_id, is_demo, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'not_started', NULL, 0, 0, '', NULL, 0, ?, ?)
          `)
          .bind(
            generateId('hw'),
            sId,
            String(body.subject || 'General'),
            String(body.chapter || ''),
            String(body.topic || ''),
            String(body.title || 'Homework'),
            String(body.instructions || ''),
            String(body.assignedDate || formatIstDate(new Date())),
            String(body.dueDate || formatIstDate(new Date())),
            Number(body.estimatedMinutes || 20),
            String(body.priority || 'normal'),
            String(body.source || 'tuition'),
            now,
            now,
          )
          .run();
      }
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap }, 201);
    }

    const hwIdMatch = url.pathname.match(/^\/api\/homework\/([^/]+)$/);
    if (hwIdMatch && method === 'PUT') {
      const id = hwIdMatch[1];
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const now = new Date().toISOString();
      const completedDate = body.status === 'completed' || body.status === 'verified' ? formatIstDate(new Date()) : null;

      await env.DB
        .prepare(`
          UPDATE homework SET
            status = COALESCE(?, status),
            completion_pct = COALESCE(?, completion_pct),
            teacher_verified = COALESCE(?, teacher_verified),
            needs_help = COALESCE(?, needs_help),
            remarks = COALESCE(?, remarks),
            due_date = COALESCE(?, due_date),
            completed_date = COALESCE(?, completed_date),
            updated_at = ?
          WHERE id = ?
        `)
        .bind(
          body.status !== undefined ? String(body.status) : null,
          body.completionPct !== undefined ? Number(body.completionPct) : null,
          body.teacherVerified !== undefined ? (body.teacherVerified ? 1 : 0) : null,
          body.needsHelp !== undefined ? (body.needsHelp ? 1 : 0) : null,
          body.remarks !== undefined ? String(body.remarks) : null,
          body.dueDate !== undefined ? String(body.dueDate) : null,
          completedDate,
          now,
          id,
        )
        .run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    if (hwIdMatch && method === 'DELETE') {
      const id = hwIdMatch[1];
      await env.DB.prepare('DELETE FROM homework WHERE id = ?').bind(id).run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    if (url.pathname === '/api/homework/carry-forward' && method === 'POST') {
      const snap = await getWorkspaceSnapshot(env.DB);
      const drafts = buildCarryForwardHomeworkDrafts({
        homework: snap.homework,
        fromDate: snap.todayIst,
        toDate: addDaysToDateStr(snap.todayIst, 1),
      });
      const now = new Date().toISOString();

      for (const d of drafts) {
        await env.DB
          .prepare('UPDATE homework SET status = ?, updated_at = ? WHERE id = ?')
          .bind('carried_forward', now, d.carriedFromId)
          .run();

        await env.DB
          .prepare(`
            INSERT INTO homework (
              id, student_id, subject, chapter, topic, title, instructions, assigned_date, due_date,
              estimated_minutes, priority, source, completion_pct, status, teacher_verified, needs_help, remarks, carried_from_id, is_demo, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_started', 0, 0, ?, ?, 0, ?, ?)
          `)
          .bind(
            generateId('hw'),
            d.studentId,
            d.subject,
            d.chapter,
            d.topic,
            d.title,
            d.instructions,
            d.assignedDate,
            d.dueDate,
            d.estimatedMinutes,
            d.priority,
            d.source,
            d.completionPct,
            d.remarks,
            d.carriedFromId,
            now,
            now,
          )
          .run();
      }
      const updatedSnap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ carriedCount: drafts.length, snapshot: updatedSnap, ...updatedSnap });
    }

    // Exams
    if (url.pathname === '/api/exams' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const id = generateId('ex');
      const now = new Date().toISOString();
      await env.DB
        .prepare(`
          INSERT INTO exams (
            id, student_id, subject, exam_name, exam_type, exam_date, syllabus, max_marks,
            obtained_marks, important_chapters_json, preparation_status, revision_plan, weak_areas_json, is_demo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `)
        .bind(
          id,
          String(body.studentId),
          String(body.subject),
          String(body.examName),
          String(body.examType || 'unit_test'),
          String(body.examDate),
          String(body.syllabus || ''),
          Number(body.maxMarks || 50),
          body.obtainedMarks != null ? Number(body.obtainedMarks) : null,
          JSON.stringify(body.importantChapters || []),
          Number(body.preparationStatus || 25),
          String(body.revisionPlan || ''),
          JSON.stringify(body.weakAreas || []),
          now,
          now,
        )
        .run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap }, 201);
    }

    const examIdMatch = url.pathname.match(/^\/api\/exams\/([^/]+)$/);
    if (examIdMatch && method === 'PUT') {
      const id = examIdMatch[1];
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const now = new Date().toISOString();
      await env.DB
        .prepare(`
          UPDATE exams SET
            subject = COALESCE(?, subject),
            exam_name = COALESCE(?, exam_name),
            exam_type = COALESCE(?, exam_type),
            exam_date = COALESCE(?, exam_date),
            syllabus = COALESCE(?, syllabus),
            max_marks = COALESCE(?, max_marks),
            obtained_marks = ?,
            important_chapters_json = COALESCE(?, important_chapters_json),
            preparation_status = COALESCE(?, preparation_status),
            revision_plan = COALESCE(?, revision_plan),
            weak_areas_json = COALESCE(?, weak_areas_json),
            updated_at = ?
          WHERE id = ?
        `)
        .bind(
          body.subject !== undefined ? String(body.subject) : null,
          body.examName !== undefined ? String(body.examName) : null,
          body.examType !== undefined ? String(body.examType) : null,
          body.examDate !== undefined ? String(body.examDate) : null,
          body.syllabus !== undefined ? String(body.syllabus) : null,
          body.maxMarks !== undefined ? Number(body.maxMarks) : null,
          body.obtainedMarks !== undefined ? (body.obtainedMarks != null ? Number(body.obtainedMarks) : null) : null,
          body.importantChapters !== undefined ? JSON.stringify(body.importantChapters) : null,
          body.preparationStatus !== undefined ? Number(body.preparationStatus) : null,
          body.revisionPlan !== undefined ? String(body.revisionPlan) : null,
          body.weakAreas !== undefined ? JSON.stringify(body.weakAreas) : null,
          now,
          id,
        )
        .run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    if (examIdMatch && method === 'DELETE') {
      const id = examIdMatch[1];
      await env.DB.prepare('DELETE FROM exams WHERE id = ?').bind(id).run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    // Older clients can still request an existing billing month explicitly.
    if (url.pathname === '/api/fees/generate-month' && method === 'POST') {
      const body = await request.json().catch(() => ({})) as { monthKey?: unknown } | null;
      const today = formatIstDate();
      const month = billingMonthSchema.safeParse(body?.monthKey ?? today.slice(0, 7));
      if (!month.success || month.data > today.slice(0, 7)) return errorResponse('Choose a current or previous billing month.');
      const [billing, settings] = await Promise.all([getBillingData(env.DB, today), getSettings(env.DB)]);
      const { created } = await ensureMonthlyBills(env.DB, billing, settings, month.data, today);
      return jsonResponse({ created, snapshot: await getWorkspaceSnapshot(env.DB) });
    }

    if (url.pathname === '/api/fees/payments' && method === 'POST') {
      const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return errorResponse('Invalid payment details.');
      const payment = parsed.data;
      const today = formatIstDate();
      const findReceipt = (field: 'id' | 'idempotency_key', value: string) => env.DB
        .prepare(`SELECT ${paymentReceiptColumns} FROM fee_payments WHERE ${field} = ?`).bind(value).first<PaymentReceipt>();
      const [billing, settings] = await Promise.all([getBillingData(env.DB, today, true), getSettings(env.DB)]);
      await ensureMonthlyBills(env.DB, billing, settings, today.slice(0, 7), today);

      for (let attempt = 0; attempt < 3; attempt++) {
        if (payment.idempotencyKey) {
          const previous = await findReceipt('idempotency_key', payment.idempotencyKey);
          if (previous) {
            if (previous.student_id !== payment.studentId || previous.amount_paise !== payment.amountPaise) {
              return errorResponse('This payment request was already used. Reopen Record payment and try again.', 409);
            }
            return jsonResponse({ paymentId: previous.id, receiptNumber: previous.receipt_number, snapshot: await getWorkspaceSnapshot(env.DB) });
          }
        }
        const student = await env.DB.prepare('SELECT full_name, billing_revision FROM students WHERE id = ?')
          .bind(payment.studentId).first<{ full_name: string; billing_revision: number }>();
        if (!student) return errorResponse('Student not found.', 404);
        const rows = (await env.DB.prepare('SELECT * FROM fee_invoices WHERE student_id = ?')
          .bind(payment.studentId).all<Record<string, unknown>>()).results;
        const invoices = rows.map((row) => mapBillingInvoice(row, today));
        if (payment.invoiceId) {
          const target = invoices.find((invoice) => invoice.id === payment.invoiceId);
          if (!target) return errorResponse('Invoice not found for this student.', 404);
          if (invoiceBalance(target) === 0) {
            const previous = payment.idempotencyKey && await findReceipt('idempotency_key', payment.idempotencyKey);
            if (previous) continue;
            return errorResponse('This bill no longer has a balance. Open Record payment to update the selection.', 409);
          }
        }

        const id = generateId('pay');
        const results = await runBillingBatch(env.DB, paymentStatements(payment, invoices, student.billing_revision, id, today, new Date().toISOString()));
        if (!results[0].meta?.changes) continue;
        const receipt = await findReceipt('id', id);
        if (!receipt) throw new Error('Recorded payment has no receipt.');
        await logAudit(env.DB, 'RECORD_PAYMENT', 'payment', id, `Recorded ${formatRupeesFromPaise(payment.amountPaise)} for ${student.full_name} (${receipt.receipt_number})`);
        return jsonResponse({ paymentId: id, receiptNumber: receipt.receipt_number, snapshot: await getWorkspaceSnapshot(env.DB) }, 201);
      }
      return errorResponse('The fee balance changed while saving. Please try again.', 409);
    }

    const invoiceMatch = url.pathname.match(/^\/api\/fees\/invoices\/([^/]+)(?:\/waive)?$/);
    if (invoiceMatch && method === 'PUT') {
      const patch = invoicePatchSchema.safeParse(await request.json().catch(() => null));
      if (!patch.success) return errorResponse('Enter a valid due date or waiver status.');
      const id = invoiceMatch[1];
      const { sql, values } = invoiceAdjustment(id, patch.data, formatIstDate(), new Date().toISOString());
      const result = await env.DB.prepare(sql).bind(...values).run();
      if (!result.meta?.changes) return errorResponse('Invoice not found.', 404);
      await logAudit(env.DB, 'INVOICE_ADJUST', 'invoice', id, 'Updated invoice due date or waiver');
      return jsonResponse(await getWorkspaceSnapshot(env.DB));
    }

    // Discounts
    if (url.pathname === '/api/discounts' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const id = generateId('dsc');
      await env.DB
        .prepare('INSERT INTO discounts (id, name, kind, value, scope, student_id, class_level, board, start_date, end_date, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)')
        .bind(
          id,
          String(body.name),
          String(body.kind || 'fixed'),
          Number(body.value || 0),
          String(body.scope || 'global'),
          body.studentId ? String(body.studentId) : null,
          body.classLevel != null ? Number(body.classLevel) : null,
          body.board ? String(body.board) : null,
          body.startDate ? String(body.startDate) : null,
          body.endDate ? String(body.endDate) : null,
          new Date().toISOString(),
        )
        .run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap }, 201);
    }

    const discIdMatch = url.pathname.match(/^\/api\/discounts\/([^/]+)$/);
    if (discIdMatch && method === 'DELETE') {
      const id = discIdMatch[1];
      await env.DB.prepare('DELETE FROM discounts WHERE id = ?').bind(id).run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    // Daily Progress
    if (url.pathname === '/api/progress' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const now = new Date().toISOString();
      const id = generateId('prg');
      await env.DB
        .prepare(`
          INSERT INTO daily_progress (
            id, student_id, date, subjects_covered_json, topics_studied, homework_completed_count,
            homework_remaining_count, doubts_cleared, teacher_comment, improvement_areas,
            next_session_tasks, completion_pct, is_demo, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
          ON CONFLICT(student_id, date) DO UPDATE SET
            subjects_covered_json = excluded.subjects_covered_json,
            topics_studied = excluded.topics_studied,
            homework_completed_count = excluded.homework_completed_count,
            homework_remaining_count = excluded.homework_remaining_count,
            doubts_cleared = excluded.doubts_cleared,
            teacher_comment = excluded.teacher_comment,
            improvement_areas = excluded.improvement_areas,
            next_session_tasks = excluded.next_session_tasks,
            completion_pct = excluded.completion_pct,
            updated_at = excluded.updated_at
        `)
        .bind(
          id,
          String(body.studentId),
          String(body.date),
          JSON.stringify(body.subjectsCovered || []),
          String(body.topicsStudied || ''),
          Number(body.homeworkCompletedCount || 0),
          Number(body.homeworkRemainingCount || 0),
          String(body.doubtsCleared || ''),
          String(body.teacherComment || ''),
          String(body.improvementAreas || ''),
          String(body.nextSessionTasks || ''),
          Number(body.completionPct || 80),
          now,
        )
        .run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    // Notifications
    if (url.pathname === '/api/notifications/push') {
      if (method === 'GET') {
        const { publicKey } = await getPushKeys(env.DB);
        return jsonResponse({ publicKey });
      }
      if (method === 'POST') {
        const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return errorResponse('Unsupported or invalid push subscription.');
        const { endpoint, keys } = parsed.data;
        await env.DB.prepare(`
          INSERT INTO web_push_subscriptions (endpoint, teacher_id, p256dh, auth)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET teacher_id = excluded.teacher_id,
            p256dh = excluded.p256dh, auth = excluded.auth
        `).bind(endpoint, authedTeacher.id, keys.p256dh, keys.auth).run();
        return jsonResponse({ enabled: true });
      }
      if (method === 'DELETE') {
        const parsed = pushEndpointSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return errorResponse('Invalid push subscription.');
        await env.DB.prepare('DELETE FROM web_push_subscriptions WHERE endpoint = ? AND teacher_id = ?')
          .bind(parsed.data.endpoint, authedTeacher.id).run();
        return jsonResponse({ enabled: false });
      }
    }
    const notifReadMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (notifReadMatch && method === 'POST') {
      const id = notifReadMatch[1];
      await env.DB.prepare('UPDATE notifications SET read = 1 WHERE id = ?').bind(id).run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    if (url.pathname === '/api/notifications/read-all' && method === 'POST') {
      await env.DB.prepare('UPDATE notifications SET read = 1').run();
      const snap = await getWorkspaceSnapshot(env.DB);
      return jsonResponse({ snapshot: snap, ...snap });
    }

    // 12. Settings
    if (url.pathname === '/api/settings' && method === 'PUT') {
      const body = (await request.json().catch(() => ({}))) as TuitionSettings;
      const saved = await saveSettings(env.DB, body);
      await logAudit(env.DB, 'UPDATE_SETTINGS', 'settings', 'default', 'Updated tuition settings');
      return jsonResponse(saved);
    }

    // Fallback: If url is under /api/ and wasn't handled, return 404 JSON (NOT static asset 405)
    if (url.pathname.startsWith('/api/')) {
      return errorResponse(`API endpoint not found: ${method} ${url.pathname}`, 404);
    }

    // Forward non-API requests to static assets
    return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('Tuitio request failed', error);
      return errorResponse('The server could not complete this request. Please try again.', 500);
    }
  },

  async scheduled(controller: { cron: string; scheduledTime: number }, env: Env): Promise<void> {
    const today = formatIstDate(new Date(controller.scheduledTime));
    if (today !== formatIstDate()) return;
    if (controller.cron === '0 12 * * *') {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO notifications (
          id, category, title, message, priority, dedup_key, scheduled_for, created_at
        ) VALUES (?, 'daily_preparation', 'Evening Tuition Prep Ready',
          'Open Tuitio to review today’s plan, expected students, and fee reminders.', 'normal', ?, ?, ?)
      `).bind(`ntf-${today}`, `cron-prep:${today}`, `${today} 17:30`, new Date().toISOString()).run();
    }
    let [billing, settings] = await Promise.all([getBillingData(env.DB, today, true), getSettings(env.DB)]);
    const generated = await ensureMonthlyBills(env.DB, billing, settings, today.slice(0, 7), today);
    if (generated.attempted) billing = await getBillingData(env.DB, today, true);
    const count = await reconcileFeeAlerts(env.DB, billing, today);
    await sendFeePush(env.DB, today, count);
  },
};
