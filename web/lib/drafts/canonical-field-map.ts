import type { ExtractionFactKey } from '@/types/extraction';
import type { PriorAuthDraftFieldKey } from '@/types/prior-auth-draft';

/** Single semantic boundary between extraction names and draft field names. */
const directFieldMap: Partial<Record<ExtractionFactKey, PriorAuthDraftFieldKey>> = {
  patientName: 'patientName',
  dateOfBirth: 'dateOfBirth',
  memberPolicyId: 'memberPolicyId',
  providerName: 'orderingProvider',
  providerNpi: 'providerNpi',
  payerInsurer: 'payerInsurer',
  requestedEquipment: 'requestedEquipment',
  requestedAccessories: 'requestedAccessories',
  hcpcsCodes: 'hcpcsCodes',
  physicianOrderDetails: 'orderDetails',
  diagnosisTermsCodes: 'diagnosisTermsCodes',
  functionalLimitations: 'functionalLimitations',
  evaluationFindings: 'evaluationFindings',
  medicalRationale: 'medicalRationale',
  evaluationDates: 'evaluationDates',
};

export function canonicalDraftFieldForFact(
  fieldKey: ExtractionFactKey,
  detectedDocumentType: string | null,
): PriorAuthDraftFieldKey | null {
  if (fieldKey === 'documentDate') {
    return detectedDocumentType === 'Physician Order / Prescription' ? 'orderDate' : null;
  }
  return directFieldMap[fieldKey] ?? null;
}
