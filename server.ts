import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import { billingMonthSchema, invoiceAdjustment, invoicePatchSchema, mapBillingInvoice, paymentReceiptColumns, paymentSchema, paymentStatements, type PaymentReceipt } from './server/billing';
import { attendanceDeleteSql, attendanceSchema, attendanceUpsert, bulkAttendanceSchema, mapAttendance } from './server/attendance';
import { examCreateSchema, examInsert, examPatchSchema, examUpdate, homeworkAssignment, homeworkCarryForward, homeworkCreateSchema, homeworkPatchSchema } from './server/classwork';
import { studentCreateSchema, studentPatchSchema } from './server/studentPayload';
import {
  clearDemoWorkspace,
  createSession,
  db,
  deleteSession,
  ensureLocalMonthlyBills,
  generateId,
  getSessionTeacher,
  getSettings,
  getTeacherCount,
  getWorkspaceSnapshot,
  hashPassword,
  logAudit,
  saveSettings,
  runLocalBillingBatch,
  seedDemoWorkspace,
  verifyPassword,
} from './server/db';
import {
  getInvoicePaymentDueDate,
  invoiceBalance,
  computeInvoiceStatus,
} from './src/engines/feeEngine';
import { buildCarryForwardHomeworkDrafts } from './src/engines/schedulerEngine';
import { addDaysToDateStr, formatIstDate, formatRupeesFromPaise } from './src/engines/istDate';
import type { BoardType, ClassLevel, Student, TuitionSettings } from './src/types';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Simple in-memory rate limiter for auth endpoints
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 20;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
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

function extractToken(req: express.Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.tuitio_session || '';
}

function setSessionCookie(req: express.Request, res: express.Response, token: string) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    `tuitio_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${60 * 60 * 24 * 14}`,
    isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(req: express.Request, res: express.Response) {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const attrs = [
    'tuitio_session=',
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}


async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  // Basic security headers (avoid X-Frame-Options so AI Studio preview iframe works)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // --- AUTH ENDPOINTS ---

  app.get('/api/auth/status', (req, res) => {
    const token = extractToken(req);
    const teacher = getSessionTeacher(token);
    res.json({
      initialized: getTeacherCount() > 0,
      authenticated: Boolean(teacher),
      teacher,
      hasEnvPasscode: Boolean(process.env.TEACHER_ADMIN_PASSCODE?.trim()),
    });
  });

  const setupSchema = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(120),
    password: z.string().min(6).max(128),
    tuitionName: z.string().trim().min(2).max(100).optional(),
    sessionStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    sessionEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    supportedBoards: z.array(z.enum(['SSC', 'CBSE', 'ICSE'])).min(1).optional(),
    includeDemoData: z.boolean().optional(),
  });

  app.post('/api/auth/setup', (req, res) => {
    if (getTeacherCount() > 0) {
      return res.status(409).json({ error: 'Teacher account is already configured. Please sign in.' });
    }
    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please provide valid account details (password min 6 chars).' });
    }
    const data = parsed.data;
    const { hash, salt } = hashPassword(data.password);
    const teacherId = generateId('tch');
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO teachers (id, email, name, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(teacherId, data.email.toLowerCase(), data.name, hash, salt, now, now);

    const settings = getSettings();
    settings.teacherName = data.name;
    settings.contactEmail = data.email.toLowerCase();
    if (data.tuitionName) settings.tuitionName = data.tuitionName;
    if (data.sessionStart) settings.sessionStart = data.sessionStart;
    if (data.sessionEnd) settings.sessionEnd = data.sessionEnd;
    if (data.supportedBoards) settings.supportedBoards = data.supportedBoards;
    settings.setupCompleted = true;
    saveSettings(settings);

    if (data.includeDemoData) {
      seedDemoWorkspace();
    }

    logAudit('SETUP_TEACHER', 'teacher', teacherId, `Initialized teacher account for ${data.name}`);
    const session = createSession(teacherId);
    setSessionCookie(req, res, session.token);

    return res.status(201).json({
      token: session.token,
      teacher: { id: teacherId, email: data.email.toLowerCase(), name: data.name },
    });
  });

  // First-run demo bootstrap (ONLY works if no real teacher has claimed the workspace yet)
  app.post('/api/auth/demo-bootstrap', (req, res) => {
    if (getTeacherCount() > 0) {
      // Allow re-entering ONLY if the only account is the built-in un-claimed demo account
      const demoRow = db
        .prepare("SELECT id, email, name FROM teachers WHERE id = 'demo-teacher'")
        .get() as { id: string; email: string; name: string } | undefined;
      if (!demoRow) {
        return res.status(403).json({ error: 'Workspace is already claimed by a teacher account. Please sign in.' });
      }
      seedDemoWorkspace();
      const session = createSession(demoRow.id);
      setSessionCookie(req, res, session.token);
      return res.json({ token: session.token, teacher: demoRow });
    }

    const { hash, salt } = hashPassword(crypto.randomBytes(16).toString('hex'));
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO teachers (id, email, name, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run('demo-teacher', 'meera.classes@tuitio.in', 'Meera Deshmukh', hash, salt, now, now);

    const settings = getSettings();
    settings.setupCompleted = true;
    saveSettings(settings);
    seedDemoWorkspace();

    const session = createSession('demo-teacher');
    setSessionCookie(req, res, session.token);
    return res.status(201).json({
      token: session.token,
      teacher: { id: 'demo-teacher', email: 'meera.classes@tuitio.in', name: 'Meera Deshmukh' },
    });
  });

  const loginSchema = z.object({
    email: z.string().trim().min(1).max(120),
    password: z.string().min(1).max(128),
  });

  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || 'local';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many sign-in attempts. Please wait a few minutes.' });
    }
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const { email, password } = parsed.data;
    const row = db
      .prepare('SELECT id, email, name, password_hash, password_salt FROM teachers WHERE LOWER(email) = LOWER(?)')
      .get(email) as
      | { id: string; email: string; name: string; password_hash: string; password_salt: string }
      | undefined;

    const envPass = process.env.TEACHER_ADMIN_PASSCODE?.trim();
    let valid = false;
    let targetTeacher = row;

    if (envPass) {
      const a = Buffer.from(password);
      const b = Buffer.from(envPass);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        valid = true;
        if (!targetTeacher) {
          targetTeacher = db
            .prepare('SELECT id, email, name, password_hash, password_salt FROM teachers LIMIT 1')
            .get() as typeof row;
        }
      }
    }

    if (!valid && row) {
      valid = verifyPassword(password, row.password_hash, row.password_salt);
    }

    if (!valid || !targetTeacher) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const session = createSession(targetTeacher.id);
    setSessionCookie(req, res, session.token);
    return res.json({
      token: session.token,
      teacher: { id: targetTeacher.id, email: targetTeacher.email, name: targetTeacher.name },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractToken(req);
    deleteSession(token);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // --- AUTHENTICATION + CSRF MIDDLEWARE FOR PROTECTED API ROUTES ---
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/auth/')) return next();

    const token = extractToken(req);
    const teacher = getSessionTeacher(token);
    if (!teacher) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // CSRF protection for cookie-authenticated mutations
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const hasBearer = Boolean(req.headers.authorization?.startsWith('Bearer '));
    if (isMutation && !hasBearer) {
      const xrw = req.headers['x-requested-with'];
      const origin = req.headers.origin;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      let originOk = false;
      if (origin && host) {
        try {
          originOk = new URL(origin).host === host;
        } catch {
          originOk = false;
        }
      }
      if (xrw !== 'Tuitio-Client' && !originOk) {
        return res.status(403).json({ error: 'Cross-site request rejected.' });
      }
    }

    (req as express.Request & { teacher: typeof teacher }).teacher = teacher;
    next();
  });

  // --- WORKSPACE SNAPSHOT ---
  app.get('/api/workspace', (_req, res) => {
    res.json(getWorkspaceSnapshot());
  });

  // --- DEMO DATA CONTROLS ---
  app.post('/api/demo/seed', (_req, res) => {
    seedDemoWorkspace();
    res.json(getWorkspaceSnapshot());
  });

  app.post('/api/demo/clear', (_req, res) => {
    clearDemoWorkspace();
    res.json(getWorkspaceSnapshot());
  });

  // --- STUDENTS ---

  app.post('/api/students', (req, res) => {
    const parsed = studentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid student fields', details: parsed.error.flatten() });
    }
    const d = parsed.data;
    const id = generateId('stu');
    const palette = ['#0284C7', '#0369A1', '#0EA5E9', '#075985', '#38BDF8'];
    const color = d.avatarColor ?? palette[parseInt(id.slice(-2), 16) % palette.length];

    const now = new Date().toISOString();
    const admDate = d.admissionDate ?? formatIstDate();
    const dueDay = d.feeDueDay ?? Number(admDate.slice(8));

    db.prepare(`
      INSERT INTO students (
        id, student_code, full_name, nickname, avatar_color, class_level, board, school_name,
        admission_date, date_of_birth, student_phone, parent_name, parent_phone,
        emergency_contact, address, subjects_json, strengths_json, weaknesses_json,
        academic_performance, preferred_arrival_time, allocated_slot, expected_duration_minutes,
        regular_days_json, fee_due_day, monthly_payment_day, fee_override_json, credit_balance_paise, notes,
        learning_speed, priority, academic_goals, status, is_demo, created_at, updated_at
      )
      SELECT ?, printf('TUI-%03d', COALESCE(MAX(CAST(substr(student_code, 5) AS INTEGER)), 100) + 1),
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'active', 0, ?, ?
      FROM students WHERE student_code GLOB 'TUI-[0-9]*' AND substr(student_code, 5) NOT GLOB '*[^0-9]*'
    `).run(
      id,
      d.fullName,
      d.nickname || null,
      color,
      d.classLevel,
      d.board,
      d.schoolName,
      admDate,
      d.dateOfBirth || null,
      d.studentPhone || null,
      d.parentName,
      d.parentPhone,
      d.emergencyContact || null,
      d.address || null,
      JSON.stringify(d.subjects),
      JSON.stringify(d.strengths),
      JSON.stringify(d.weaknesses),
      d.academicPerformance,
      d.preferredArrivalTime,
      d.allocatedSlot,
      d.expectedDurationMinutes,
      JSON.stringify(d.regularDays),
      Math.min(dueDay, 28),
      dueDay,
      d.feeOverride ? JSON.stringify(d.feeOverride) : null,
      d.notes,
      d.learningSpeed,
      d.priority,
      d.academicGoals,
      now,
      now,
    );

    logAudit('ADD_STUDENT', 'student', id, `Enrolled ${d.fullName} (Class ${d.classLevel} ${d.board})`);
    res.status(201).json({ id, snapshot: getWorkspaceSnapshot() });
  });

  const handleUpdateStudent = (req: express.Request, res: express.Response) => {
    const parsed = studentPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid student update payload.' });
    }
    const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Student not found.' });

    const d = parsed.data;
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare(`
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
      `).run(
        d.fullName ?? null,
        Number(d.nickname !== undefined),
        d.nickname || null,
        d.avatarColor ?? null,
        d.classLevel ?? null,
        d.board ?? null,
        d.schoolName ?? null,
        d.admissionDate ?? null,
        d.dateOfBirth ?? null,
        d.studentPhone ?? null,
        d.parentName ?? null,
        d.parentPhone ?? null,
        d.emergencyContact ?? null,
        d.address ?? null,
        d.subjects ? JSON.stringify(d.subjects) : null,
        d.strengths ? JSON.stringify(d.strengths) : null,
        d.weaknesses ? JSON.stringify(d.weaknesses) : null,
        d.academicPerformance ?? null,
        d.preferredArrivalTime ?? null,
        d.allocatedSlot ?? null,
        d.expectedDurationMinutes ?? null,
        d.regularDays ? JSON.stringify(d.regularDays) : null,
        d.feeDueDay === undefined ? null : Math.min(d.feeDueDay, 28),
        d.feeDueDay ?? null,
        Number(d.feeOverride !== undefined),
        d.feeOverride ? JSON.stringify(d.feeOverride) : null,
        d.notes ?? null,
        d.learningSpeed ?? null,
        d.priority ?? null,
        d.academicGoals ?? null,
        now,
        req.params.id,
      );

      if (d.feeDueDay !== undefined) {
        const today = formatIstDate();
        const invoices = db.prepare(`
          SELECT id, month_key, total_amount_paise, paid_amount_paise FROM fee_invoices
          WHERE student_id = ? AND substr(due_date, 1, 7) >= ? AND due_date_overridden = 0 AND status IN ('unpaid', 'partial', 'overdue')
        `).all(req.params.id, today.slice(0, 7));
        const update = db.prepare('UPDATE fee_invoices SET due_date = ?, status = ?, updated_at = ? WHERE id = ? AND due_date <> ?');
        for (const invoice of invoices) {
          const due = getInvoicePaymentDueDate(String(invoice.month_key), d.feeDueDay);
          const status = computeInvoiceStatus(Number(invoice.total_amount_paise), Number(invoice.paid_amount_paise), due, today, false);
          update.run(due, status, now, invoice.id, due);
        }
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    logAudit('UPDATE_STUDENT', 'student', req.params.id, `Updated profile for ${d.fullName ?? existing.full_name}`);
    const snap = getWorkspaceSnapshot();
    res.json({ snapshot: snap, ...snap });
  };

  app.put('/api/students/:id', handleUpdateStudent);
  app.post('/api/students/:id', (req, res, next) => {
    if (req.params.id === 'promote') return next();
    return handleUpdateStudent(req, res);
  });

  app.post('/api/students/:id/status', (req, res) => {
    const schema = z.object({
      status: z.enum(['active', 'paused', 'inactive', 'discontinued', 'graduated']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid student status.' });

    const existing = db.prepare('SELECT full_name FROM students WHERE id = ?').get(req.params.id) as
      | { full_name: string }
      | undefined;
    if (!existing) return res.status(404).json({ error: 'Student not found.' });

    const now = new Date().toISOString();
    const discAt = parsed.data.status === 'discontinued' ? formatIstDate(new Date()) : null;
    db.prepare('UPDATE students SET status = ?, discontinued_at = ?, updated_at = ? WHERE id = ?').run(
      parsed.data.status,
      discAt,
      now,
      req.params.id,
    );
    logAudit(
      'CHANGE_STATUS',
      'student',
      req.params.id,
      `Set ${existing.full_name} status to ${parsed.data.status} (all historical records preserved)`,
    );
    res.json(getWorkspaceSnapshot());
  });

  // Explicit permanent privacy removal (never called by normal discontinue)
  app.delete('/api/students/:id', (req, res) => {
    if (req.body?.confirmDelete !== true) {
      return res.status(400).json({ error: 'Explicit confirmation required for permanent removal.' });
    }
    const existing = db.prepare('SELECT full_name FROM students WHERE id = ?').get(req.params.id) as
      | { full_name: string }
      | undefined;
    if (!existing) return res.status(404).json({ error: 'Student not found.' });
    db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
    logAudit('PERMANENT_DELETE', 'student', req.params.id, `Permanently removed records for ${existing.full_name}`);
    res.json(getWorkspaceSnapshot());
  });

  // Promote individual or bulk students (never rewrites historical invoices!)
  app.post('/api/students/promote', (req, res) => {
    const schema = z.object({
      studentIds: z.array(z.string().min(1)).min(1),
      overridePolicy: z.enum(['keep_override', 'adopt_class_rate']).default('adopt_class_rate'),
      targetBoard: z.enum(['SSC', 'CBSE', 'ICSE']).optional(),
      effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid promotion request.' });

    const now = new Date().toISOString();
    const { studentIds, overridePolicy, targetBoard } = parsed.data;
    let promoted = 0;
    let graduated = 0;

    for (const sid of studentIds) {
      const row = db
        .prepare('SELECT id, full_name, class_level, board, fee_override_json FROM students WHERE id = ?')
        .get(sid) as
        | { id: string; full_name: string; class_level: ClassLevel; board: BoardType; fee_override_json: string | null }
        | undefined;
      if (!row) continue;

      if (row.class_level >= 10) {
        db.prepare('UPDATE students SET status = ?, updated_at = ? WHERE id = ?').run('graduated', now, sid);
        graduated += 1;
        logAudit('GRADUATE_STUDENT', 'student', sid, `Graduated ${row.full_name} after Class 10`);
      } else {
        const nextClass = row.class_level + 1;
        const nextBoard = targetBoard ?? row.board;
        const nextOverride = overridePolicy === 'keep_override' ? row.fee_override_json : null;
        db.prepare(
          'UPDATE students SET class_level = ?, board = ?, fee_override_json = ?, updated_at = ? WHERE id = ?',
        ).run(nextClass, nextBoard, nextOverride, now, sid);
        promoted += 1;
        logAudit(
          'PROMOTE_STUDENT',
          'student',
          sid,
          `Promoted ${row.full_name} from Class ${row.class_level} to Class ${nextClass} (${nextBoard}) — future billing updated`,
        );
      }
    }

    res.json({ promoted, graduated, snapshot: getWorkspaceSnapshot() });
  });

  // --- ATTENDANCE ---
  app.post('/api/attendance', (req, res) => {
    const parsed = attendanceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid attendance details.' });
    const entry = parsed.data;
    let attendance = null;
    if (entry.status === 'unmarked') {
      db.prepare(attendanceDeleteSql).run(entry.studentId, entry.date);
    } else {
      const { sql, values } = attendanceUpsert(entry, generateId('att'), new Date().toISOString());
      const row = db.prepare(sql + ' RETURNING *').get(...values);
      if (row) attendance = mapAttendance(row);
    }
    res.json(req.query.response === 'record' ? { attendance } : getWorkspaceSnapshot());
  });

  app.post('/api/attendance/bulk', (req, res) => {
    const parsed = bulkAttendanceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid bulk attendance details.' });
    const { date, entries } = parsed.data;
    const now = new Date().toISOString();
    runLocalBillingBatch(entries.map((entry) => attendanceUpsert({ ...entry, date }, generateId('att'), now)));
    logAudit('BULK_ATTENDANCE', 'attendance', date, `Marked attendance for ${entries.length} students`);
    res.json(getWorkspaceSnapshot());
  });

  // --- HOMEWORK ---
  app.post('/api/homework', (req, res) => {
    const parsed = homeworkCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Check the students, homework title and due date.' });
    const now = new Date();
    runLocalBillingBatch(homeworkAssignment(parsed.data, formatIstDate(now), now.toISOString(), () => generateId('hw')));
    res.status(201).json(getWorkspaceSnapshot());
  });

  app.put('/api/homework/:id', (req, res) => {
    const parsed = homeworkPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid homework update.' });
    const d = parsed.data;
    const now = new Date().toISOString();
    const completed = d.status === 'completed' || d.status === 'verified';

    const result = db.prepare(`
      UPDATE homework SET
        status = COALESCE(?, status),
        completion_pct = COALESCE(?, completion_pct),
        teacher_verified = COALESCE(?, teacher_verified),
        needs_help = COALESCE(?, needs_help),
        remarks = COALESCE(?, remarks),
        due_date = COALESCE(?, due_date),
        completed_date = CASE WHEN ? THEN COALESCE(completed_date, ?) WHEN ? THEN NULL ELSE completed_date END,
        updated_at = ?
      WHERE id = ?
    `).run(
      d.status ?? null,
      d.completionPct ?? null,
      d.teacherVerified !== undefined ? (d.teacherVerified ? 1 : 0) : null,
      d.needsHelp !== undefined ? (d.needsHelp ? 1 : 0) : null,
      d.remarks ?? null,
      d.dueDate ?? null,
      Number(completed),
      formatIstDate(new Date()),
      Number(d.status !== undefined),
      now,
      req.params.id,
    );
    if (!result.changes) return res.status(404).json({ error: 'Homework not found.' });
    res.json(getWorkspaceSnapshot());
  });

  app.delete('/api/homework/:id', (req, res) => {
    db.prepare('DELETE FROM homework WHERE id = ?').run(req.params.id);
    res.json(getWorkspaceSnapshot());
  });

  app.post('/api/homework/carry-forward', (req, res) => {
    const snapshot = getWorkspaceSnapshot();
    const fromDate = req.body?.fromDate || snapshot.todayIst;
    const toDate = req.body?.toDate || addDaysToDateStr(fromDate, 1);
    const drafts = buildCarryForwardHomeworkDrafts({
      homework: snapshot.homework,
      fromDate,
      toDate,
    });
    const now = new Date().toISOString();
    const results = runLocalBillingBatch(drafts.map((draft) => homeworkCarryForward(draft, generateId('hw'), now)));
    const carriedCount = results.reduce((count, changes) => count + changes, 0);
    res.json({ carriedCount, snapshot: carriedCount ? getWorkspaceSnapshot() : snapshot });
  });

  // --- EXAMS ---
  app.post('/api/exams', (req, res) => {
    const parsed = examCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid exam details.' });
    if (!db.prepare('SELECT id FROM students WHERE id = ?').get(parsed.data.studentId)) {
      return res.status(404).json({ error: 'Student not found.' });
    }
    const { sql, values } = examInsert(parsed.data, generateId('ex'), new Date().toISOString());
    db.prepare(sql).run(...values);
    res.status(201).json(getWorkspaceSnapshot());
  });

  app.put('/api/exams/:id', (req, res) => {
    const parsed = examPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid exam details.' });
    const { sql, values } = examUpdate(parsed.data, req.params.id, new Date().toISOString());
    if (!db.prepare(sql).run(...values).changes) {
      if (!db.prepare('SELECT id FROM exams WHERE id = ?').get(req.params.id)) {
        return res.status(404).json({ error: 'Exam not found.' });
      }
      return res.status(400).json({ error: 'Marks cannot exceed the maximum marks.' });
    }
    res.json(getWorkspaceSnapshot());
  });

  app.delete('/api/exams/:id', (req, res) => {
    db.prepare('DELETE FROM exams WHERE id = ?').run(req.params.id);
    res.json(getWorkspaceSnapshot());
  });

  // --- FEES, DISCOUNTS & PAYMENTS ---
  app.post('/api/fees/generate-month', (req, res) => {
    const today = formatIstDate();
    const month = billingMonthSchema.safeParse(req.body?.monthKey ?? today.slice(0, 7));
    if (!month.success || month.data > today.slice(0, 7)) {
      return res.status(400).json({ error: 'Choose a current or previous billing month.' });
    }
    const state = getWorkspaceSnapshot();
    const created = ensureLocalMonthlyBills(state, month.data);
    res.json({ created, snapshot: getWorkspaceSnapshot() });
  });

  app.post('/api/fees/payments', (req, res) => {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payment details.' });
    const payment = parsed.data;
    const findReceipt = (field: 'id' | 'idempotency_key', value: string) =>
      db.prepare(`SELECT ${paymentReceiptColumns} FROM fee_payments WHERE ${field} = ?`).get(value) as PaymentReceipt | undefined;
    const state = getWorkspaceSnapshot();
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = payment.idempotencyKey ? findReceipt('idempotency_key', payment.idempotencyKey) : undefined;
      if (previous) {
        if (previous.student_id !== payment.studentId || previous.amount_paise !== payment.amountPaise) {
          return res.status(409).json({ error: 'This payment request was already used. Reopen Record payment and try again.' });
        }
        return res.json({ paymentId: previous.id, receiptNumber: previous.receipt_number, snapshot: state });
      }

      const student = db.prepare('SELECT full_name, billing_revision FROM students WHERE id = ?').get(payment.studentId) as
        { full_name: string; billing_revision: number } | undefined;
      if (!student) return res.status(404).json({ error: 'Student not found.' });
      const invoices = db.prepare('SELECT * FROM fee_invoices WHERE student_id = ?').all(payment.studentId)
        .map((row) => mapBillingInvoice(row, state.todayIst));
      if (payment.invoiceId) {
        const target = invoices.find((invoice) => invoice.id === payment.invoiceId);
        if (!target) return res.status(404).json({ error: 'Invoice not found for this student.' });
        if (invoiceBalance(target) === 0) {
          if (payment.idempotencyKey && findReceipt('idempotency_key', payment.idempotencyKey)) continue;
          return res.status(409).json({ error: 'This bill no longer has a balance. Open Record payment to update the selection.' });
        }
      }

      const id = generateId('pay');
      const [inserted] = runLocalBillingBatch(paymentStatements(payment, invoices, student.billing_revision, id, state.todayIst, new Date().toISOString()));
      if (!inserted) continue;
      const receipt = findReceipt('id', id);
      if (!receipt) throw new Error('Recorded payment has no receipt.');
      logAudit('RECORD_PAYMENT', 'payment', id, `Recorded ${formatRupeesFromPaise(payment.amountPaise)} for ${student.full_name} (${receipt.receipt_number})`);
      return res.status(201).json({ paymentId: id, receiptNumber: receipt.receipt_number, snapshot: getWorkspaceSnapshot() });
    }
    return res.status(409).json({ error: 'The fee balance changed while saving. Please try again.' });
  });

  app.put(['/api/fees/invoices/:id', '/api/fees/invoices/:id/waive'], (req, res) => {
    const patch = invoicePatchSchema.safeParse(req.body);
    if (!patch.success) return res.status(400).json({ error: 'Enter a valid due date or waiver status.' });
    const { sql, values } = invoiceAdjustment(req.params.id, patch.data, formatIstDate(), new Date().toISOString());
    if (!db.prepare(sql).run(...values).changes) return res.status(404).json({ error: 'Invoice not found.' });
    logAudit('INVOICE_ADJUST', 'invoice', req.params.id, 'Updated invoice due date or waiver');
    res.json(getWorkspaceSnapshot());
  });

  const discountSchema = z.object({
    name: z.string().trim().min(2).max(80),
    kind: z.enum(['fixed', 'percentage']),
    value: z.number().int().min(1),
    scope: z.enum(['student', 'class', 'board', 'global']),
    studentId: z.string().optional(),
    classLevel: z.number().int().min(3).max(10).optional(),
    board: z.enum(['SSC', 'CBSE', 'ICSE']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  });

  app.post('/api/discounts', (req, res) => {
    const parsed = discountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid discount configuration.' });
    const d = parsed.data;
    if (d.kind === 'percentage' && d.value > 100) {
      return res.status(400).json({ error: 'Percentage discount cannot exceed 100%.' });
    }
    const id = generateId('dsc');
    db.prepare(`
      INSERT INTO discounts (id, name, kind, value, scope, student_id, class_level, board, start_date, end_date, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      id,
      d.name,
      d.kind,
      d.value,
      d.scope,
      d.studentId || null,
      d.classLevel ?? null,
      d.board || null,
      d.startDate || null,
      d.endDate || null,
      new Date().toISOString(),
    );
    logAudit('ADD_DISCOUNT', 'discount', id, `Created ${d.scope} discount: ${d.name}`);
    res.status(201).json(getWorkspaceSnapshot());
  });

  app.delete('/api/discounts/:id', (req, res) => {
    db.prepare('DELETE FROM discounts WHERE id = ?').run(req.params.id);
    logAudit('REMOVE_DISCOUNT', 'discount', req.params.id, 'Removed discount rule');
    res.json(getWorkspaceSnapshot());
  });

  // --- DAILY PROGRESS ---
  app.post('/api/progress', (req, res) => {
    const schema = z.object({
      studentId: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      subjectsCovered: z.array(z.string()).default([]),
      topicsStudied: z.string().max(400).default(''),
      homeworkCompletedCount: z.number().int().min(0).default(0),
      homeworkRemainingCount: z.number().int().min(0).default(0),
      doubtsCleared: z.string().max(400).default(''),
      teacherComment: z.string().max(500).default(''),
      improvementAreas: z.string().max(400).default(''),
      nextSessionTasks: z.string().max(400).default(''),
      completionPct: z.number().int().min(0).max(100).default(80),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid progress log.' });
    const d = parsed.data;
    const now = new Date().toISOString();
    db.prepare(`
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
    `).run(
      generateId('prg'),
      d.studentId,
      d.date,
      JSON.stringify(d.subjectsCovered),
      d.topicsStudied,
      d.homeworkCompletedCount,
      d.homeworkRemainingCount,
      d.doubtsCleared,
      d.teacherComment,
      d.improvementAreas,
      d.nextSessionTasks,
      d.completionPct,
      now,
    );
    res.json(getWorkspaceSnapshot());
  });

  // --- NOTIFICATIONS ---
  app.post('/api/notifications/:id/read', (req, res) => {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
    res.json(getWorkspaceSnapshot());
  });

  app.post('/api/notifications/read-all', (_req, res) => {
    db.prepare('UPDATE notifications SET read = 1').run();
    res.json(getWorkspaceSnapshot());
  });

  // --- SETTINGS ---
  app.put('/api/settings', (req, res) => {
    const current = getSettings();
    const incoming = req.body as Partial<TuitionSettings>;
    const merged: TuitionSettings = {
      ...current,
      ...incoming,
      feeConfig: {
        ...current.feeConfig,
        ...(incoming.feeConfig || {}),
        classRatesPaise: {
          ...current.feeConfig.classRatesPaise,
          ...(incoming.feeConfig?.classRatesPaise || {}),
        },
        boardSurchargesPaise: {
          ...current.feeConfig.boardSurchargesPaise,
          ...(incoming.feeConfig?.boardSurchargesPaise || {}),
        },
      },
      reminders: {
        ...current.reminders,
        ...(incoming.reminders || {}),
      },
    };
    saveSettings(merged);
    logAudit('UPDATE_SETTINGS', 'settings', 'default', 'Updated tuition configuration & fee rules');
    res.json(getWorkspaceSnapshot());
  });

  // --- BACKUP & RESTORE ---
  app.get('/api/backup/export', (_req, res) => {
    const snap = getWorkspaceSnapshot();
    res.setHeader('Content-Disposition', `attachment; filename="tuitio-backup-${snap.todayIst}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      data: snap,
    });
  });

  app.post('/api/backup/restore', (req, res) => {
    const payload = req.body?.data;
    if (!payload || !payload.settings || !Array.isArray(payload.students)) {
      return res.status(400).json({ error: 'Invalid backup file format.' });
    }
    saveSettings(payload.settings);
    const now = new Date().toISOString();

    const insertStudent = db.prepare(`
      INSERT OR REPLACE INTO students (
        id, student_code, full_name, avatar_color, class_level, board, school_name,
        admission_date, date_of_birth, student_phone, parent_name, parent_phone,
        emergency_contact, address, subjects_json, strengths_json, weaknesses_json,
        academic_performance, preferred_arrival_time, allocated_slot, expected_duration_minutes,
        regular_days_json, fee_due_day, fee_override_json, credit_balance_paise, notes,
        learning_speed, priority, academic_goals, status, discontinued_at, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of payload.students as Student[]) {
      insertStudent.run(
        s.id,
        s.studentCode,
        s.fullName,
        s.avatarColor || '#0284C7',
        s.classLevel,
        s.board,
        s.schoolName || '',
        s.admissionDate,
        s.dateOfBirth ?? null,
        s.studentPhone ?? null,
        s.parentName,
        s.parentPhone,
        s.emergencyContact ?? null,
        s.address ?? null,
        JSON.stringify(s.subjects || []),
        JSON.stringify(s.strengths || []),
        JSON.stringify(s.weaknesses || []),
        s.academicPerformance ?? 75,
        s.preferredArrivalTime || '18:00',
        s.allocatedSlot || '18:00–20:00',
        s.expectedDurationMinutes ?? 90,
        JSON.stringify(s.regularDays || [1, 2, 3, 4, 5, 6]),
        s.feeDueDay ?? 5,
        s.feeOverride ? JSON.stringify(s.feeOverride) : null,
        s.creditBalancePaise ?? 0,
        s.notes || '',
        s.learningSpeed || 'steady',
        s.priority || 'normal',
        s.academicGoals || '',
        s.status || 'active',
        s.discontinuedAt ?? null,
        s.isDemo ? 1 : 0,
        s.createdAt || now,
        now,
      );
    }

    logAudit('RESTORE_BACKUP', 'workspace', 'backup', `Restored ${payload.students.length} students & settings from JSON backup`);
    res.json(getWorkspaceSnapshot());
  });

  // --- FRONTEND SERVING (VITE MIDDLEWARE IN DEV, STATIC DIST IN PROD) ---
  if (!IS_PROD) {
    const viteClientNoWsShim = `
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay extends HTMLElement {}
`;
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.type('application/javascript').send(viteClientNoWsShim);
    });

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Tuitio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Tuitio server:', err);
  process.exit(1);
});
