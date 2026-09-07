import { z } from 'zod';

export const draftFieldIdSchema = z.uuid();

export const updateDraftFieldSchema = z
  .object({
    value: z.string().trim().min(1).max(2_000),
  })
  .strict();
