import { z } from 'zod';

const studentPayloadSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  avatarColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  nickname: z.string().trim().max(50).optional().nullable(),
  classLevel: z.number().int().min(3).max(10),
  board: z.enum(['SSC', 'CBSE', 'ICSE']),
  schoolName: z.string().trim().max(120),
  admissionDate: z.iso.date().optional(),
  dateOfBirth: z.string().optional(),
  studentPhone: z.string().max(25).optional(),
  parentName: z.string().trim().max(100),
  parentPhone: z.string().trim().max(25),
  emergencyContact: z.string().max(25).optional(),
  address: z.string().max(240).optional(),
  subjects: z.array(z.string().trim()),
  strengths: z.array(z.string().trim()),
  weaknesses: z.array(z.string().trim()),
  academicPerformance: z.number().min(0).max(100),
  preferredArrivalTime: z.string().regex(/^\d{2}:\d{2}$/),
  allocatedSlot: z.string().max(40),
  expectedDurationMinutes: z.number().int().min(30).max(240),
  regularDays: z.array(z.number().int().min(0).max(6)),
  feeDueDay: z.number().int().min(1).max(31).optional(),
  feeOverride: z
    .object({
      amountPaise: z.number().int().min(0),
      isTemporary: z.boolean(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      reason: z.string().optional(),
    })
    .nullable()
    .optional(),
  notes: z.string().max(1000),
  learningSpeed: z.enum(['fast', 'steady', 'needs_support']),
  priority: z.enum(['high', 'normal', 'low']),
  academicGoals: z.string().max(300),
});

export const studentPatchSchema = studentPayloadSchema.partial();

export const studentCreateSchema = studentPayloadSchema.extend({
  schoolName: studentPayloadSchema.shape.schoolName.default(''),
  parentName: studentPayloadSchema.shape.parentName.default(''),
  parentPhone: studentPayloadSchema.shape.parentPhone.default(''),
  subjects: studentPayloadSchema.shape.subjects.default([]),
  strengths: studentPayloadSchema.shape.strengths.default([]),
  weaknesses: studentPayloadSchema.shape.weaknesses.default([]),
  academicPerformance: studentPayloadSchema.shape.academicPerformance.default(75),
  preferredArrivalTime: studentPayloadSchema.shape.preferredArrivalTime.default('18:00'),
  allocatedSlot: studentPayloadSchema.shape.allocatedSlot.default('18:00–20:00'),
  expectedDurationMinutes: studentPayloadSchema.shape.expectedDurationMinutes.default(120),
  regularDays: studentPayloadSchema.shape.regularDays.default([1, 2, 3, 4, 5, 6]),
  notes: studentPayloadSchema.shape.notes.default(''),
  learningSpeed: studentPayloadSchema.shape.learningSpeed.default('steady'),
  priority: studentPayloadSchema.shape.priority.default('normal'),
  academicGoals: studentPayloadSchema.shape.academicGoals.default(''),
});
