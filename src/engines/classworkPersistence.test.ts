import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { attendanceSchema, attendanceUpsert } from '../../server/attendance';
import { examCreateSchema, examInsert, examPatchSchema, examUpdate, homeworkAssignment, homeworkCarryForward, homeworkCreateSchema } from '../../server/classwork';
import type { HomeworkItem } from '../types';

const day = '2026-11-24';
const now = `${day}T12:00:00.000Z`;

function setup(t: TestContext) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync('cloudflare/migrations/0001_initial.sql', 'utf8'));
  db.prepare(`INSERT INTO students (id, student_code, full_name, avatar_color, class_level, board, admission_date,
    parent_name, parent_phone, created_at, updated_at) VALUES ('s1', '1', 'QA Student', '', 5, 'SSC', ?, '', '', ?, ?)`)
    .run(day, now, now);
  return db;
}

test('exam writes work with the D1 schema and an unrelated edit preserves marks', (t) => {
  const db = setup(t);
  const exam = { studentId: 's1', subject: 'Math', examName: 'Unit Test', examDate: day, preparationStatus: 0 };
  assert.equal(examCreateSchema.safeParse({ ...exam, examDate: '2026-02-30' }).success, false);
  const insert = examInsert(examCreateSchema.parse(exam), 'ex1', now);
  db.prepare(insert.sql).run(...insert.values);
  assert.equal(db.prepare('SELECT preparation_status FROM exams').get()?.preparation_status, 0);

  for (const patch of [{ obtainedMarks: 31.5 }, { preparationStatus: 90, syllabus: 'Fractions' }]) {
    const update = examUpdate(examPatchSchema.parse(patch), 'ex1', now);
    assert.equal(db.prepare(update.sql).run(...update.values).changes, 1);
  }

  const invalid = examUpdate({ maxMarks: 30 }, 'ex1', now);
  assert.equal(db.prepare(invalid.sql).run(...invalid.values).changes, 0);
  const saved = db.prepare('SELECT obtained_marks, preparation_status, syllabus FROM exams').get();
  assert.deepEqual({ ...saved }, { obtained_marks: 31.5, preparation_status: 90, syllabus: 'Fractions' });
});

test('homework assignment saves its template and a retried carry-forward cannot duplicate tasks', (t) => {
  const db = setup(t);
  const task = homeworkCreateSchema.parse({ studentIds: ['s1', 's1'], subject: 'Math', title: 'Fractions', dueDate: day, saveAsTemplate: true });
  let id = 0;
  const writes = homeworkAssignment(task, day, now, () => `hw${++id}`);
  for (const write of writes) db.prepare(write.sql).run(...write.values);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM homework_templates').get()?.count, 1);

  const draft: Omit<HomeworkItem, 'updatedAt' | 'id'> = {
    ...task, studentId: 's1', assignedDate: day, dueDate: '2026-11-25', completionPct: 30,
    status: 'carried_forward', teacherVerified: false, needsHelp: true, remarks: '', carriedFromId: 'hw1',
  };
  for (const key of ['first', 'retry']) {
    const write = homeworkCarryForward(draft, key, now);
    db.prepare(write.sql).run(...write.values);
  }
  const carried = db.prepare('SELECT completion_pct, needs_help FROM homework WHERE carried_from_id = ?').all('hw1');
  assert.deepEqual(carried.map((row) => ({ ...row })), [{ completion_pct: 30, needs_help: 1 }]);
});

test('attendance writes preserve untouched notes and can explicitly clear arrival times', (t) => {
  const db = setup(t);
  const initial = { studentId: 's1', date: day, status: 'present', actualArrivalTime: '18:05', note: 'Arrived early' };
  for (const [index, entry] of [initial, { studentId: 's1', date: day, status: 'absent', actualArrivalTime: null }].entries()) {
    const write = attendanceUpsert(attendanceSchema.parse(entry), `att${index}`, now);
    db.prepare(write.sql).run(...write.values);
  }
  const row = db.prepare('SELECT id, status, actual_arrival_time, note FROM attendance').get();
  assert.deepEqual({ ...row }, { id: 'att0', status: 'absent', actual_arrival_time: null, note: initial.note });
});
