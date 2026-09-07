import { z } from 'zod';

import { priorAuthDraftFieldKeys } from '@/types/prior-auth-draft';

const noteSchema = z
  .object({
    text: z.string().trim().min(1).max(260),
    fieldKeys: z.array(z.enum(priorAuthDraftFieldKeys)).min(1).max(4),
    sourceFactIds: z.array(z.uuid()).max(8),
  })
  .strict();

export const caseDraftNotesSchema = z
  .object({
    keySupportingEvidence: z.array(noteSchema).max(6),
    missingInformation: z.array(noteSchema).max(6),
    conflictingInformation: z.array(noteSchema).max(6),
    areasRequiringReview: z.array(noteSchema).max(6),
  })
  .strict();
