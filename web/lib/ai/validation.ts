import { z } from 'zod';

export const documentIdSchema = z.uuid();
export const analysisIdSchema = z.uuid();
export const factIdSchema = z.uuid();

export const reviewFactSchema = z
  .object({
    decision: z.enum(['ACCEPTED', 'EDITED', 'REJECTED']),
    reviewedValue: z.string().trim().max(1_000).optional(),
  })
  .strict();
