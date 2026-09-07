import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq } from 'drizzle-orm';

import { getDatabase, type DatabaseClient } from '@/db/client';
import {
  casePolicySelections,
  payerPolicies,
  payers,
  policyRequirements,
  readinessEvaluations,
  readinessRequirementResults,
  users,
} from '@/db/schema';
import type {
  PayerPolicy,
  PolicyOption,
  PolicyRequirement,
  ReadinessEvaluation,
  ReadinessRequirementResult,
} from '@/types/policy';

function parseCodes(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function toRequirement(record: typeof policyRequirements.$inferSelect): PolicyRequirement {
  return {
    id: record.id,
    policyId: record.policyId,
    requirementKey: record.requirementKey,
    label: record.label,
    kind: record.kind,
    documentType: record.documentType ?? null,
    fieldKey: record.fieldKey ?? null,
    conditionType: record.conditionType,
    conditionValue: record.conditionValue ?? null,
    requirementLevel: record.requirementLevel,
    explanation: record.explanation,
    blocksReadiness: record.blocksReadiness,
    sortOrder: record.sortOrder,
  };
}

function toPolicy(
  record: typeof payerPolicies.$inferSelect,
  payer: typeof payers.$inferSelect,
  requirements: PolicyRequirement[],
): PayerPolicy {
  return {
    id: record.id,
    payerId: record.payerId,
    payerName: payer.name,
    planName: payer.planName,
    policyName: record.policyName,
    equipmentCategory: record.equipmentCategory,
    hcpcsCodes: parseCodes(record.hcpcsCodesJson),
    effectiveDate: record.effectiveDate,
    expirationDate: record.expirationDate ?? null,
    submissionChannel: record.submissionChannel,
    followUpIntervalDays: record.followUpIntervalDays ?? null,
    sourceType: record.sourceType,
    sourceReference: record.sourceReference,
    notes: record.notes,
    version: record.version,
    isSynthetic: record.isSynthetic,
    isActive: record.isActive,
    requirements,
  };
}

function toOption(policy: PayerPolicy): PolicyOption {
  return {
    id: policy.id,
    payerName: policy.payerName,
    planName: policy.planName,
    policyName: policy.policyName,
    equipmentCategory: policy.equipmentCategory,
    version: policy.version,
    effectiveDate: policy.effectiveDate,
    expirationDate: policy.expirationDate,
    submissionChannel: policy.submissionChannel,
    followUpIntervalDays: policy.followUpIntervalDays,
    sourceType: policy.sourceType,
    sourceReference: policy.sourceReference,
    isSynthetic: policy.isSynthetic,
  };
}

export function getPolicy(
  policyId: string,
  db: DatabaseClient = getDatabase(),
): PayerPolicy | null {
  const row = db
    .select({ policy: payerPolicies, payer: payers })
    .from(payerPolicies)
    .innerJoin(payers, eq(payerPolicies.payerId, payers.id))
    .where(eq(payerPolicies.id, policyId))
    .get();
  if (!row) return null;
  const requirements = db
    .select()
    .from(policyRequirements)
    .where(eq(policyRequirements.policyId, policyId))
    .orderBy(asc(policyRequirements.sortOrder))
    .all()
    .map(toRequirement);
  return toPolicy(row.policy, row.payer, requirements);
}

export function listPolicies(
  db: DatabaseClient = getDatabase(),
): PayerPolicy[] {
  return db
    .select({ policy: payerPolicies, payer: payers })
    .from(payerPolicies)
    .innerJoin(payers, eq(payerPolicies.payerId, payers.id))
    .orderBy(asc(payers.name), asc(payers.planName), asc(payerPolicies.policyName))
    .all()
    .map((row) => {
      const requirements = db
        .select()
        .from(policyRequirements)
        .where(eq(policyRequirements.policyId, row.policy.id))
        .orderBy(asc(policyRequirements.sortOrder))
        .all()
        .map(toRequirement);
      return toPolicy(row.policy, row.payer, requirements);
    });
}

export function listActivePolicies(
  db: DatabaseClient = getDatabase(),
): PayerPolicy[] {
  return listPolicies(db).filter((policy) => policy.isActive && policy.isSynthetic);
}

export function listActivePolicyOptions(
  db: DatabaseClient = getDatabase(),
): PolicyOption[] {
  return listActivePolicies(db).map(toOption);
}

export type SavePolicyInput = {
  policyId?: string;
  payerName: string;
  planName: string;
  policyName: string;
  equipmentCategory: string;
  hcpcsCodes: string[];
  effectiveDate: string;
  expirationDate: string | null;
  submissionChannel: string;
  followUpIntervalDays: number | null;
  sourceType: string;
  sourceReference: string;
  notes: string;
  version: string;
  isActive: boolean;
  requirements: Array<Omit<PolicyRequirement, 'id' | 'policyId'>>;
};

export function savePolicy(
  input: SavePolicyInput,
  db: DatabaseClient = getDatabase(),
): PayerPolicy {
  const policyId = input.policyId ?? randomUUID();
  db.transaction((transaction) => {
    let payer = transaction
      .select()
      .from(payers)
      .where(and(eq(payers.name, input.payerName), eq(payers.planName, input.planName)))
      .get();
    if (!payer) {
      payer = transaction
        .insert(payers)
        .values({ id: randomUUID(), name: input.payerName, planName: input.planName, isActive: true })
        .returning()
        .get();
    } else if (!payer.isActive) {
      transaction.update(payers).set({ isActive: true }).where(eq(payers.id, payer.id)).run();
    }

    const existing = transaction
      .select()
      .from(payerPolicies)
      .where(eq(payerPolicies.id, policyId))
      .get();
    const values = {
      payerId: payer.id,
      policyName: input.policyName,
      equipmentCategory: input.equipmentCategory,
      hcpcsCodesJson: JSON.stringify(input.hcpcsCodes),
      effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate,
      submissionChannel: input.submissionChannel,
      followUpIntervalDays: input.followUpIntervalDays,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference,
      notes: input.notes,
      version: input.version,
      isSynthetic: true,
      isActive: input.isActive,
    };
    if (existing) {
      transaction.update(payerPolicies).set(values).where(eq(payerPolicies.id, policyId)).run();
      transaction.delete(policyRequirements).where(eq(policyRequirements.policyId, policyId)).run();
    } else {
      transaction.insert(payerPolicies).values({ id: policyId, ...values }).run();
    }
    if (input.requirements.length) {
      transaction.insert(policyRequirements).values(
        input.requirements.map((requirement) => ({
          id: randomUUID(),
          policyId,
          requirementKey: requirement.requirementKey,
          label: requirement.label,
          kind: requirement.kind,
          documentType: requirement.documentType,
          fieldKey: requirement.fieldKey,
          conditionType: requirement.conditionType,
          conditionValue: requirement.conditionValue,
          requirementLevel: requirement.requirementLevel,
          explanation: requirement.explanation,
          blocksReadiness: requirement.blocksReadiness,
          sortOrder: requirement.sortOrder,
        })),
      ).run();
    }
  });
  const saved = getPolicy(policyId, db);
  if (!saved) throw new Error('Saved payer policy was not found.');
  return saved;
}

export function getSelectedPolicy(
  caseId: string,
  db: DatabaseClient = getDatabase(),
): { policy: PayerPolicy; selectionType: 'AUTOMATIC' | 'MANUAL' } | null {
  const row = db
    .select({ selection: casePolicySelections, policyId: casePolicySelections.policyId })
    .from(casePolicySelections)
    .where(eq(casePolicySelections.caseId, caseId))
    .get();
  if (!row) return null;
  const policy = getPolicy(row.policyId, db);
  return policy ? { policy, selectionType: row.selection.selectionType } : null;
}

export function savePolicySelection(
  input: { caseId: string; policyId: string; selectionType: 'AUTOMATIC' | 'MANUAL'; userId: string | null },
  db: DatabaseClient = getDatabase(),
): void {
  const now = new Date();
  const existing = db.select().from(casePolicySelections).where(eq(casePolicySelections.caseId, input.caseId)).get();
  if (existing) {
    db.update(casePolicySelections)
      .set({ policyId: input.policyId, selectionType: input.selectionType, selectedByUserId: input.userId, selectedAt: now })
      .where(eq(casePolicySelections.id, existing.id))
      .run();
  } else {
    db.insert(casePolicySelections).values({ id: randomUUID(), caseId: input.caseId, policyId: input.policyId, selectionType: input.selectionType, selectedByUserId: input.userId, selectedAt: now }).run();
  }
}

export type PersistReadinessInput = {
  caseId: string;
  policyId: string | null;
  policyMatchStatus: ReadinessEvaluation['policyMatchStatus'];
  policyMatchReason: string;
  selectionType: ReadinessEvaluation['selectionType'];
  status: ReadinessEvaluation['status'];
  satisfiedCount: number;
  applicableCount: number;
  nextBestAction: string;
  evaluatedByUserId: string;
  requirements: Array<Omit<ReadinessRequirementResult, 'id'>>;
};

export function saveReadinessEvaluation(
  input: PersistReadinessInput,
  db: DatabaseClient = getDatabase(),
): string {
  const evaluationId = randomUUID();
  db.transaction((transaction) => {
    transaction.insert(readinessEvaluations).values({
      id: evaluationId,
      caseId: input.caseId,
      policyId: input.policyId,
      policyMatchStatus: input.policyMatchStatus,
      policyMatchReason: input.policyMatchReason,
      selectionType: input.selectionType,
      status: input.status,
      satisfiedCount: input.satisfiedCount,
      applicableCount: input.applicableCount,
      nextBestAction: input.nextBestAction,
      evaluatedByUserId: input.evaluatedByUserId,
      evaluatedAt: new Date(),
    }).run();
    if (input.policyId && input.requirements.length) {
      transaction.insert(readinessRequirementResults).values(
        input.requirements.map((requirement) => ({
          id: randomUUID(),
          evaluationId,
          requirementId: requirement.requirementId,
          requirementKey: requirement.requirementKey,
          label: requirement.label,
          status: requirement.status,
          reason: requirement.reason,
          sourceDocumentIdsJson: JSON.stringify(requirement.sourceDocumentIds),
          sourceFieldKeysJson: JSON.stringify(requirement.sourceFieldKeys),
          explanation: requirement.explanation,
          blocksReadiness: requirement.blocksReadiness,
        })),
      ).run();
    }
  });
  return evaluationId;
}

function toResult(record: typeof readinessRequirementResults.$inferSelect): ReadinessRequirementResult {
  return {
    id: record.id,
    requirementId: record.requirementId,
    requirementKey: record.requirementKey,
    label: record.label,
    status: record.status,
    reason: record.reason,
    sourceDocumentIds: parseStringArray(record.sourceDocumentIdsJson),
    sourceFieldKeys: parseStringArray(record.sourceFieldKeysJson),
    explanation: record.explanation,
    blocksReadiness: record.blocksReadiness,
  };
}

export function getLatestReadiness(
  caseId: string,
  db: DatabaseClient = getDatabase(),
): ReadinessEvaluation | null {
  const row = db
    .select({ evaluation: readinessEvaluations })
    .from(readinessEvaluations)
    .where(eq(readinessEvaluations.caseId, caseId))
    .orderBy(desc(readinessEvaluations.evaluatedAt))
    .limit(1)
    .get();
  if (!row) return null;
  const policy = row.evaluation.policyId ? getPolicy(row.evaluation.policyId, db) : null;
  const evaluator = row.evaluation.evaluatedByUserId
    ? db
        .select({ name: users.displayName })
        .from(users)
        .where(eq(users.id, row.evaluation.evaluatedByUserId))
        .get()
    : null;
  const results = db
    .select()
    .from(readinessRequirementResults)
    .where(eq(readinessRequirementResults.evaluationId, row.evaluation.id))
    .all()
    .map(toResult);
  return {
    id: row.evaluation.id,
    caseId: row.evaluation.caseId,
    policy: policy ? toOption(policy) : null,
    policyMatchStatus: row.evaluation.policyMatchStatus,
    policyMatchReason: row.evaluation.policyMatchReason,
    selectionType: row.evaluation.selectionType,
    status: row.evaluation.status,
    satisfiedCount: row.evaluation.satisfiedCount,
    applicableCount: row.evaluation.applicableCount,
    nextBestAction: row.evaluation.nextBestAction,
    evaluatedAt: row.evaluation.evaluatedAt.toISOString(),
    evaluatedByDisplayName: evaluator?.name ?? null,
    requirements: results,
  };
}
