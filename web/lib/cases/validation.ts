import { z } from 'zod';

import {
  caseStatuses,
  checklistStatuses,
  documentationTypes,
} from '@/types/case';

export const caseIdSchema = z
  .string()
  .regex(/^RM-PA-\d{4}$/, 'Invalid case identifier.');

export const updateCaseStatusSchema = z.object({
  status: z.enum(caseStatuses),
});

export const updateChecklistStatusSchema = z.object({
  status: z.enum(checklistStatuses),
});

export const addCaseNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Enter a note before saving.')
    .max(2_000, 'Case notes must contain at most 2,000 characters.'),
});

export const documentTypeSchema = z.enum(documentationTypes);

export const checklistItemIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^RM-PA-\d{4}:[A-Z_]+$/, 'Invalid checklist item identifier.');
