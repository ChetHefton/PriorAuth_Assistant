import { z } from 'zod';

// Keep this schema JSON-Schema representable for OpenAI Structured Outputs.
// Nullable subject normalization happens after parsing in the provider.
export const communicationDraftSchema = z.object({
  subject: z.string().nullable(),
  body: z.string().min(1),
  notes: z.array(z.string()).default([]),
});

export type CommunicationDraft = {
  subject?: string;
  body: string;
  notes: string[];
};
