import { z } from 'zod';
import type { HomeworkItem } from '../src/types';

const examFields = z.object({
  studentId: z.string().min(1, 'Choose a student.'),
  subject: z.string().trim().min(1).max(60),
  examName: z.string().trim().min(2, 'Enter an exam name of at least two characters.').max(120),
  examType: z.enum(['school_exam', 'unit_test', 'weekly_test', 'revision_test', 'tuition_test']),
  examDate: z.iso.date({ error: 'Enter a valid exam date.' }),
  syllabus: z.string().max(400),
  maxMarks: z.number().int().min(1).max(500),
  obtainedMarks: z.number().min(0).max(500).nullable(),
  importantChapters: z.array(z.string()),
  preparationStatus: z.number().int().min(0).max(100),
  revisionPlan: z.string().max(500),
  weakAreas: z.array(z.string()),
});

export const examCreateSchema = examFields.extend({
  examType: examFields.shape.examType.default('unit_test'),
  syllabus: examFields.shape.syllabus.default(''),
  maxMarks: examFields.shape.maxMarks.default(50),
  obtainedMarks: examFields.shape.obtainedMarks.default(null),
  importantChapters: examFields.shape.importantChapters.default([]),
  preparationStatus: examFields.shape.preparationStatus.default(25),
  revisionPlan: examFields.shape.revisionPlan.default(''),
  weakAreas: examFields.shape.weakAreas.default([]),
}).refine((exam) => exam.obtainedMarks === null || exam.obtainedMarks <= exam.maxMarks, {
  message: 'Marks cannot exceed the maximum marks.',
});

export const examPatchSchema = examFields.omit({ studentId: true }).partial();

export function examInsert(exam: z.infer<typeof examCreateSchema>, id: string, now: string) {
  return {
    sql: `INSERT INTO exams (
      id, student_id, subject, exam_name, exam_type, exam_date, syllabus, max_marks,
      obtained_marks, important_chapters_json, preparation_status, revision_plan, weak_areas_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [id, exam.studentId, exam.subject, exam.examName, exam.examType, exam.examDate, exam.syllabus,
      exam.maxMarks, exam.obtainedMarks, JSON.stringify(exam.importantChapters), exam.preparationStatus,
      exam.revisionPlan, JSON.stringify(exam.weakAreas), now],
  };
}

export function examUpdate(exam: z.infer<typeof examPatchSchema>, id: string, now: string) {
  return {
    sql: `UPDATE exams SET
      subject = COALESCE(?, subject), exam_name = COALESCE(?, exam_name), exam_type = COALESCE(?, exam_type),
      exam_date = COALESCE(?, exam_date), syllabus = COALESCE(?, syllabus), max_marks = COALESCE(?, max_marks),
      obtained_marks = CASE WHEN ? THEN ? ELSE obtained_marks END,
      important_chapters_json = COALESCE(?, important_chapters_json),
      preparation_status = COALESCE(?, preparation_status), revision_plan = COALESCE(?, revision_plan),
      weak_areas_json = COALESCE(?, weak_areas_json), updated_at = ?
      WHERE id = ? AND COALESCE(CASE WHEN ? THEN ? ELSE obtained_marks END, 0) <= COALESCE(?, max_marks)`,
    values: [exam.subject ?? null, exam.examName ?? null, exam.examType ?? null, exam.examDate ?? null,
      exam.syllabus ?? null, exam.maxMarks ?? null, Number(exam.obtainedMarks !== undefined), exam.obtainedMarks ?? null,
      exam.importantChapters ? JSON.stringify(exam.importantChapters) : null, exam.preparationStatus ?? null,
      exam.revisionPlan ?? null, exam.weakAreas ? JSON.stringify(exam.weakAreas) : null, now, id,
      Number(exam.obtainedMarks !== undefined), exam.obtainedMarks ?? null, exam.maxMarks ?? null],
  };
}

export const homeworkCreateSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1),
  subject: z.string().trim().min(1).max(60),
  chapter: z.string().trim().max(100).default(''),
  topic: z.string().trim().max(100).default(''),
  title: z.string().trim().min(2).max(160),
  instructions: z.string().max(600).default(''),
  assignedDate: z.iso.date().optional(),
  dueDate: z.iso.date(),
  estimatedMinutes: z.number().int().min(5).max(180).default(20),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).default('normal'),
  source: z.enum(['school', 'tuition']).default('tuition'),
  saveAsTemplate: z.boolean().optional(),
});

export const homeworkPatchSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed', 'verified', 'partial', 'overdue', 'carried_forward']).optional(),
  completionPct: z.number().int().min(0).max(100).optional(),
  teacherVerified: z.boolean().optional(),
  needsHelp: z.boolean().optional(),
  remarks: z.string().max(500).optional(),
  dueDate: z.iso.date().optional(),
});

export function homeworkAssignment(task: z.infer<typeof homeworkCreateSchema>, assignedDate: string, now: string, nextId: () => string) {
  const writes = Array.from(new Set(task.studentIds), (id) => ({
    sql: `INSERT INTO homework (
      id, student_id, subject, chapter, topic, title, instructions, assigned_date, due_date,
      estimated_minutes, priority, source, updated_at
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
      SELECT 1 FROM homework WHERE student_id = ? AND subject = ? AND title = ? AND due_date = ?
        AND status NOT IN ('completed', 'verified')
    )`,
    values: [nextId(), id, task.subject, task.chapter, task.topic, task.title, task.instructions,
      task.assignedDate ?? assignedDate, task.dueDate, task.estimatedMinutes, task.priority, task.source,
      now, id, task.subject, task.title, task.dueDate],
  }));
  if (task.saveAsTemplate) writes.push({
    sql: `INSERT INTO homework_templates (id, title, subject, chapter, topic, instructions, estimated_minutes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    values: [nextId(), task.title, task.subject, task.chapter, task.topic, task.instructions, task.estimatedMinutes, task.source],
  });
  return writes;
}

export function homeworkCarryForward(draft: Omit<HomeworkItem, 'id' | 'updatedAt'>, id: string, now: string) {
  return {
    sql: `INSERT INTO homework (
      id, student_id, subject, chapter, topic, title, instructions, assigned_date, due_date,
      estimated_minutes, priority, source, completion_pct, status, needs_help, remarks, carried_from_id, is_demo, updated_at
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'carried_forward', ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM homework WHERE id = ? AND status NOT IN ('completed', 'verified'))
        AND NOT EXISTS (SELECT 1 FROM homework WHERE carried_from_id = ? OR (
          student_id = ? AND subject = ? AND title = ? AND due_date = ? AND status NOT IN ('completed', 'verified')
        ))`,
    values: [id, draft.studentId, draft.subject, draft.chapter, draft.topic, draft.title, draft.instructions,
      draft.assignedDate, draft.dueDate, draft.estimatedMinutes, draft.priority, draft.source, draft.completionPct,
      Number(draft.needsHelp), draft.remarks, draft.carriedFromId ?? null, Number(Boolean(draft.isDemo)), now,
      draft.carriedFromId ?? null, draft.carriedFromId ?? null, draft.studentId, draft.subject, draft.title, draft.dueDate],
  };
}
