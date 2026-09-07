import type { DatabaseClient } from '@/db/client';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  getLatestReadiness,
  getPolicy,
  getSelectedPolicy,
  listActivePolicies,
  savePolicySelection,
  saveReadinessEvaluation,
} from '@/db/repositories/policies';
import { matchPayerPolicy } from '@/lib/policies/match-policy';
import { evaluatePolicyRequirements } from '@/lib/policies/readiness-engine';
import type { CaseDetail } from '@/types/case';
import type { ReadinessEvaluation } from '@/types/policy';

export class ReadinessServiceError extends Error {
  constructor(
    message: string,
    readonly code: 'POLICY_NOT_FOUND' | 'CASE_NOT_FOUND' | 'READINESS_NOT_FOUND',
  ) {
    super(message);
  }
}

export function generateReadiness(
  input: {
    caseDetail: CaseDetail;
    actorUserId: string;
    manualPolicyId?: string;
  },
  db?: DatabaseClient,
): ReadinessEvaluation {
  const existingSelection = getSelectedPolicy(input.caseDetail.id, db);
  let policy = existingSelection?.policy ?? null;
  let selectionType = existingSelection?.selectionType ?? null;
  let matchStatus: 'MATCHED' | 'NO_MATCH' | 'AMBIGUOUS' | 'INSUFFICIENT_DATA';
  let matchReason: string;

  if (input.manualPolicyId) {
    policy = getPolicy(input.manualPolicyId, db);
    if (!policy || !policy.isActive || !policy.isSynthetic) {
      throw new ReadinessServiceError('The selected synthetic policy was not found.', 'POLICY_NOT_FOUND');
    }
    selectionType = 'MANUAL';
    matchStatus = 'MATCHED';
    matchReason = 'A specialist manually selected this configured synthetic policy.';
    savePolicySelection(
      { caseId: input.caseDetail.id, policyId: policy.id, selectionType, userId: input.actorUserId },
      db,
    );
    recordAuditEvent(
      {
        userId: input.actorUserId,
        action: 'case.policy_manually_selected',
        resourceType: 'payer_policy',
        resourceId: policy.id,
      },
      db,
    );
  } else if (policy && selectionType === 'MANUAL') {
    matchStatus = 'MATCHED';
    matchReason = 'A prior specialist policy selection is being used.';
  } else {
    const match = matchPayerPolicy({
      caseData: input.caseDetail,
      draft: input.caseDetail.priorAuthDraft,
      policies: listActivePolicies(db),
    });
    policy = match.policy;
    matchStatus = match.status;
    matchReason = match.reason;
    selectionType = policy ? 'AUTOMATIC' : null;
    if (policy) {
      savePolicySelection(
        { caseId: input.caseDetail.id, policyId: policy.id, selectionType: 'AUTOMATIC', userId: input.actorUserId },
        db,
      );
    }
  }

  const evaluated = evaluatePolicyRequirements({
    caseData: input.caseDetail,
    draft: input.caseDetail.priorAuthDraft,
    documents: input.caseDetail.documents,
    policy,
    policyMatchStatus: matchStatus,
  });
  saveReadinessEvaluation(
    {
      caseId: input.caseDetail.id,
      policyId: policy?.id ?? null,
      policyMatchStatus: matchStatus,
      policyMatchReason: matchReason,
      selectionType,
      status: evaluated.status,
      satisfiedCount: evaluated.satisfiedCount,
      applicableCount: evaluated.applicableCount,
      nextBestAction: evaluated.nextBestAction,
      evaluatedByUserId: input.actorUserId,
      requirements: evaluated.requirements,
    },
    db,
  );
  recordAuditEvent(
    {
      userId: input.actorUserId,
      action: 'case.readiness_evaluated',
      resourceType: 'prior_authorization_case',
      resourceId: input.caseDetail.id,
    },
    db,
  );
  const result = getLatestReadiness(input.caseDetail.id, db);
  if (!result) throw new ReadinessServiceError('The readiness result was not saved.', 'READINESS_NOT_FOUND');
  return result;
}
