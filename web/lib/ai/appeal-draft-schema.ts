import { z } from 'zod';
export const appealDraftSchema=z.object({subject:z.string().nullable(),body:z.string().min(1),evidenceReferences:z.array(z.string()).default([])}).transform(v=>({...v,subject:v.subject??undefined}));
export type AppealDraft=z.infer<typeof appealDraftSchema>;
