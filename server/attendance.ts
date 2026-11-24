import { z } from 'zod';
import type { AttendanceRecord } from '../src/types';

const fields = z.object({
  studentId: z.string().min(1),
  status: z.enum(['unmarked', 'present', 'absent', 'late', 'excused']),
  actualArrivalTime: z.iso.time({ precision: -1 }).nullable().optional(),
  departureTime: z.iso.time({ precision: -1 }).nullable().optional(),
  note: z.string().max(300).optional(),
});

export const attendanceSchema = fields.extend({ date: z.iso.date() });
export const bulkAttendanceSchema = z.object({
  date: z.iso.date(),
  entries: z.array(fields.extend({ status: fields.shape.status.exclude(['unmarked']) })).min(1),
});

export function attendanceUpsert(entry: z.infer<typeof attendanceSchema>, id: string, now: string) {
  return {
    sql: `INSERT INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, date) DO UPDATE SET
        status = excluded.status,
        actual_arrival_time = CASE WHEN ? THEN excluded.actual_arrival_time ELSE attendance.actual_arrival_time END,
        departure_time = CASE WHEN ? THEN excluded.departure_time ELSE attendance.departure_time END,
        note = CASE WHEN ? THEN excluded.note ELSE attendance.note END,
        updated_at = excluded.updated_at`,
    values: [id, entry.studentId, entry.date, entry.status, entry.actualArrivalTime ?? null,
      entry.departureTime ?? null, entry.note ?? '', now, Number(entry.actualArrivalTime !== undefined),
      Number(entry.departureTime !== undefined), Number(entry.note !== undefined)],
  };
}

export const attendanceDeleteSql = 'DELETE FROM attendance WHERE student_id = ? AND date = ?';

export function mapAttendance(row: Record<string, unknown>): AttendanceRecord {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    date: String(row.date),
    status: String(row.status) as AttendanceRecord['status'],
    actualArrivalTime: row.actual_arrival_time ? String(row.actual_arrival_time) : null,
    departureTime: row.departure_time ? String(row.departure_time) : null,
    note: String(row.note ?? ''),
    isDemo: Number(row.is_demo) === 1,
    updatedAt: String(row.updated_at),
  };
}
