import type { PriorAuthDraft } from '@/types/prior-auth-draft';
import type { PriorAuthorizationCase } from '@/types/case';
import type { PayerPolicy, PolicyMatch, PolicyOption } from '@/types/policy';

function normalize(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function currentPolicyDate(policy: PayerPolicy, date: string): boolean {
  return (
    policy.effectiveDate <= date &&
    (!policy.expirationDate || policy.expirationDate >= date)
  );
}

function option(policy: PayerPolicy): PolicyOption {
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

function verifiedCodes(draft: PriorAuthDraft | null): string[] {
  const field = draft?.fields.find((item) => item.fieldKey === 'hcpcsCodes');
  if (!field || field.status !== 'VERIFIED' || !field.displayValue) return [];
  return field.displayValue
    .split(/[,\s]+/)
    .map(normalize)
    .filter(Boolean);
}

export function matchPayerPolicy(
  input: {
    caseData: PriorAuthorizationCase;
    draft: PriorAuthDraft | null;
    policies: PayerPolicy[];
    asOf?: string;
  },
): PolicyMatch {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const base = input.policies.filter(
    (policy) =>
      policy.isActive &&
      policy.isSynthetic &&
      currentPolicyDate(policy, asOf) &&
      normalize(policy.payerName) === normalize(input.caseData.insurer) &&
      normalize(policy.planName) === normalize(input.caseData.insurerPlan) &&
      normalize(policy.equipmentCategory) ===
        normalize(input.caseData.equipmentCategory),
  );
  const candidates = base.map(option);
  if (!base.length) {
    return {
      status: 'NO_MATCH',
      policy: null,
      candidates: [],
      reason:
        'No active synthetic policy matches the payer, plan, equipment category, and effective date.',
    };
  }

  const codes = verifiedCodes(input.draft);
  const codeFiltered = base.filter((policy) => {
    if (!policy.hcpcsCodes.length) return true;
    if (!codes.length) return true;
    const configured = policy.hcpcsCodes.map(normalize);
    return codes.some((code) => configured.includes(code));
  });
  if (!codeFiltered.length) {
    return {
      status: 'NO_MATCH',
      policy: null,
      candidates,
      reason: 'The verified HCPCS code does not match any configured policy.',
    };
  }
  if (codeFiltered.length > 1) {
    return {
      status: 'AMBIGUOUS',
      policy: null,
      candidates: codeFiltered.map(option),
      reason: 'Multiple active policy versions match these case attributes.',
    };
  }
  const selected = codeFiltered[0]!;
  if (selected.hcpcsCodes.length && !codes.length) {
    return {
      status: 'INSUFFICIENT_DATA',
      policy: null,
      candidates: [option(selected)],
      reason: 'A configured policy requires an explicitly verified HCPCS code before matching.',
    };
  }
  return {
    status: 'MATCHED',
    policy: selected,
    candidates: [option(selected)],
    reason: 'One active synthetic policy matched the case attributes.',
  };
}
