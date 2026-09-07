import { z } from 'zod';

import {
  documentationTypes,
} from '@/types/case';
import {
  policyConditionTypes,
  policyRequirementKinds,
  policyRequirementLevels,
} from '@/types/policy';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const policyRequirementInputSchema = z
  .object({
    requirementKey: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    kind: z.enum(policyRequirementKinds),
    documentType: z.enum(documentationTypes).nullable(),
    fieldKey: z.string().trim().max(80).nullable(),
    conditionType: z.enum(policyConditionTypes),
    conditionValue: z.string().trim().max(160).nullable(),
    requirementLevel: z.enum(policyRequirementLevels),
    explanation: z.string().trim().min(1).max(500),
    blocksReadiness: z.boolean(),
    sortOrder: z.number().int().min(0).max(100),
  })
  .strict();

export const policyInputSchema = z
  .object({
    payerName: z.string().trim().min(2).max(120),
    planName: z.string().trim().min(2).max(120),
    policyName: z.string().trim().min(2).max(160),
    equipmentCategory: z.string().trim().min(2).max(120),
    hcpcsCodes: z.array(z.string().trim().min(1).max(20)).max(30),
    effectiveDate: dateSchema,
    expirationDate: dateSchema.nullable(),
    submissionChannel: z.string().trim().min(2).max(120),
    followUpIntervalDays: z.number().int().min(1).max(365).nullable(),
    sourceType: z.string().trim().min(2).max(80),
    sourceReference: z.string().trim().min(2).max(240),
    notes: z.string().trim().max(1_000),
    version: z.string().trim().min(1).max(40),
    isActive: z.boolean(),
    requirements: z.array(policyRequirementInputSchema).max(30),
  })
  .strict();

export const policyIdSchema = z.uuid();
