import type BetterSqlite3 from 'better-sqlite3';

type SeedPolicy = {
  id: string;
  payerId: string;
  payerName: string;
  planName: string;
  policyName: string;
  equipmentCategory: string;
  hcpcsCodes: string[];
  effectiveDate: string;
  submissionChannel: string;
  followUpIntervalDays: number;
  sourceReference: string;
  version: string;
  requirements: Array<{
    id: string;
    key: string;
    label: string;
    kind: 'DOCUMENT' | 'FIELD';
    documentType: string | null;
    fieldKey: string | null;
    conditionType: 'ALWAYS' | 'EQUIPMENT_CATEGORY_IS' | 'EQUIPMENT_CONTAINS' | 'HCPCS_CODE_PRESENT';
    conditionValue: string | null;
    explanation: string;
  }>;
};

const syntheticPolicies: SeedPolicy[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    payerId: '21000000-0000-4000-8000-000000000001',
    payerName: 'Meridian Demo Health',
    planName: 'Power Mobility Plan',
    policyName: 'Power Mobility Documentation Policy',
    equipmentCategory: 'Mobility',
    hcpcsCodes: [],
    effectiveDate: '2026-01-01',
    submissionChannel: 'Synthetic review queue',
    followUpIntervalDays: 5,
    sourceReference: 'Synthetic demonstration policy library · MP-1',
    version: 'v1',
    requirements: [
      { id: '22000000-0000-4000-8000-000000000001', key: 'physician-order', label: 'Physician order', kind: 'DOCUMENT', documentType: 'PHYSICIAN_ORDER', fieldKey: null, conditionType: 'ALWAYS', conditionValue: null, explanation: 'A physician order or prescription document is configured for this demonstration policy.' },
      { id: '22000000-0000-4000-8000-000000000002', key: 'pt-ot-evaluation', label: 'PT/OT evaluation', kind: 'DOCUMENT', documentType: 'PT_OT_EVALUATION', fieldKey: null, conditionType: 'ALWAYS', conditionValue: null, explanation: 'A reviewed PT/OT evaluation is configured for this demonstration policy.' },
      { id: '22000000-0000-4000-8000-000000000003', key: 'requested-equipment', label: 'Requested equipment', kind: 'FIELD', documentType: null, fieldKey: 'requestedEquipment', conditionType: 'ALWAYS', conditionValue: null, explanation: 'The requested equipment must be verified in the case-level draft.' },
      { id: '22000000-0000-4000-8000-000000000004', key: 'ordering-provider', label: 'Ordering provider', kind: 'FIELD', documentType: null, fieldKey: 'orderingProvider', conditionType: 'ALWAYS', conditionValue: null, explanation: 'The ordering provider must be verified in the case-level draft.' },
    ],
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    payerId: '21000000-0000-4000-8000-000000000002',
    payerName: 'Northstar Benefit Plan',
    planName: 'Home Equipment Plan',
    policyName: 'Home Equipment Administrative Checklist',
    equipmentCategory: 'Home medical equipment',
    hcpcsCodes: [],
    effectiveDate: '2026-01-01',
    submissionChannel: 'Synthetic secure intake',
    followUpIntervalDays: 7,
    sourceReference: 'Synthetic demonstration policy library · NE-1',
    version: 'v2',
    requirements: [
      { id: '22000000-0000-4000-8000-000000000005', key: 'physician-order', label: 'Physician order', kind: 'DOCUMENT', documentType: 'PHYSICIAN_ORDER', fieldKey: null, conditionType: 'ALWAYS', conditionValue: null, explanation: 'A physician order is configured as a required source document.' },
      { id: '22000000-0000-4000-8000-000000000006', key: 'face-to-face-evaluation', label: 'Recent face-to-face evaluation', kind: 'FIELD', documentType: null, fieldKey: 'evaluationDates', conditionType: 'ALWAYS', conditionValue: null, explanation: 'An explicitly stated evaluation date must be verified in the draft.' },
      { id: '22000000-0000-4000-8000-000000000007', key: 'clinical-chart-notes', label: 'Clinical chart notes', kind: 'DOCUMENT', documentType: 'CLINICAL_CHART_NOTES', fieldKey: null, conditionType: 'ALWAYS', conditionValue: null, explanation: 'Reviewed clinical chart notes are configured for this demonstration policy.' },
      { id: '22000000-0000-4000-8000-000000000008', key: 'requested-equipment', label: 'Requested equipment', kind: 'FIELD', documentType: null, fieldKey: 'requestedEquipment', conditionType: 'ALWAYS', conditionValue: null, explanation: 'The requested equipment must be verified in the draft.' },
    ],
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    payerId: '21000000-0000-4000-8000-000000000003',
    payerName: 'SummitCare Advantage',
    planName: 'Advantage DME Plan',
    policyName: 'DME Code and Accessory Review Policy',
    equipmentCategory: 'Diabetes supplies',
    hcpcsCodes: ['E1234', 'K0005'],
    effectiveDate: '2026-01-01',
    submissionChannel: 'Synthetic DME review queue',
    followUpIntervalDays: 3,
    sourceReference: 'Synthetic demonstration policy library · SA-1',
    version: 'v1',
    requirements: [
      { id: '22000000-0000-4000-8000-000000000009', key: 'insurance-information', label: 'Insurance information', kind: 'DOCUMENT', documentType: 'INSURANCE_INFORMATION', fieldKey: null, conditionType: 'ALWAYS', conditionValue: null, explanation: 'Reviewed insurance information is configured for this demonstration policy.' },
      { id: '22000000-0000-4000-8000-000000000010', key: 'requested-hcpcs', label: 'Requested HCPCS code', kind: 'FIELD', documentType: null, fieldKey: 'hcpcsCodes', conditionType: 'ALWAYS', conditionValue: null, explanation: 'A specialist-verified HCPCS code must be present in the draft.' },
      { id: '22000000-0000-4000-8000-000000000011', key: 'physician-order', label: 'Physician order', kind: 'DOCUMENT', documentType: 'PHYSICIAN_ORDER', fieldKey: null, conditionType: 'ALWAYS', conditionValue: null, explanation: 'A reviewed physician order is configured for this demonstration policy.' },
      { id: '22000000-0000-4000-8000-000000000012', key: 'accessory-justification', label: 'Accessory justification', kind: 'FIELD', documentType: null, fieldKey: 'requestedAccessories', conditionType: 'EQUIPMENT_CONTAINS', conditionValue: 'accessory', explanation: 'This conditional requirement applies only when the requested equipment description contains accessory.' },
    ],
  },
];

export function seedSyntheticPolicies(sqlite: BetterSqlite3.Database): void {
  const insertPayer = sqlite.prepare('INSERT OR IGNORE INTO payers (id, name, plan_name, is_active) VALUES (?, ?, ?, 1)');
  const insertPolicy = sqlite.prepare('INSERT OR IGNORE INTO payer_policies (id, payer_id, policy_name, equipment_category, hcpcs_codes_json, effective_date, expiration_date, submission_channel, follow_up_interval_days, source_type, source_reference, notes, version, is_synthetic, is_active) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, \'SYNTHETIC_DEMONSTRATION\', ?, \'Synthetic demonstration configuration; not a real payer policy.\', ?, 1, 1)');
  const insertRequirement = sqlite.prepare('INSERT OR IGNORE INTO policy_requirements (id, policy_id, requirement_key, label, kind, document_type, field_key, condition_type, condition_value, requirement_level, explanation, blocks_readiness, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, \'REQUIRED\', ?, 1, ?)');
  const migrateLegacyCasePayer = sqlite.prepare('UPDATE prior_authorization_cases SET insurer_name = ?, insurer_plan = ? WHERE id = ? AND insurer_name = ? AND insurer_plan = ?');
  const seed = sqlite.transaction(() => {
    for (const policy of syntheticPolicies) {
      insertPayer.run(policy.payerId, policy.payerName, policy.planName);
      insertPolicy.run(policy.id, policy.payerId, policy.policyName, policy.equipmentCategory, JSON.stringify(policy.hcpcsCodes), policy.effectiveDate, policy.submissionChannel, policy.followUpIntervalDays, policy.sourceReference, policy.version);
      policy.requirements.forEach((requirement, index) => insertRequirement.run(requirement.id, policy.id, requirement.key, requirement.label, requirement.kind, requirement.documentType, requirement.fieldKey, requirement.conditionType, requirement.conditionValue, requirement.explanation, index));
    }
  });
  seed();
  migrateLegacyCasePayer.run('Northstar Benefit Plan', 'Home Equipment Plan', 'RM-PA-1048', 'Aetna', 'Choice POS II');
  migrateLegacyCasePayer.run('Meridian Demo Health', 'Power Mobility Plan', 'RM-PA-1047', 'Blue Cross Blue Shield', 'PPO Gold');
  migrateLegacyCasePayer.run('SummitCare Advantage', 'Advantage DME Plan', 'RM-PA-1042', 'Blue Cross Blue Shield', 'PPO Silver');
}
