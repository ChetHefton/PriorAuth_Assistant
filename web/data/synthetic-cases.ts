import type {
  CasePriority,
  CaseStatus,
  ChecklistStatus,
  DocumentationType,
  DocumentReviewStatus,
} from '@/types/case';

export type SyntheticCaseSeed = {
  id: string;
  patientDisplayName: string;
  patientInitials: string;
  requestedEquipment: string;
  equipmentCategory: string;
  insurerName: string;
  insurerPlan: string;
  status: CaseStatus;
  priority: CasePriority;
  assignedSpecialist: string;
  followUpDue: string | null;
  createdAt: string;
  updatedAt: string;
  checklistOverrides: Partial<Record<DocumentationType, ChecklistStatus>>;
};

export const syntheticCaseSeeds: SyntheticCaseSeed[] = [
  {
    id: 'RM-PA-1048',
    patientDisplayName: 'Elena Torres',
    patientInitials: 'ET',
    requestedEquipment: 'Semi-electric hospital bed',
    equipmentCategory: 'Home medical equipment',
    insurerName: 'Northstar Benefit Plan',
    insurerPlan: 'Home Equipment Plan',
    status: 'Needs Documentation',
    priority: 'High',
    assignedSpecialist: 'Maya Chen',
    followUpDue: '2026-09-05',
    createdAt: '2026-08-28T15:20:00.000Z',
    updatedAt: '2026-09-05T15:48:00.000Z',
    checklistOverrides: {
      CLINICAL_CHART_NOTES: 'Missing',
      SUPPORTING_DOCUMENTATION: 'Missing',
      PT_OT_EVALUATION: 'Not Required',
      OTHER: 'Not Required',
    },
  },
  {
    id: 'RM-PA-1047',
    patientDisplayName: 'Marcus Lee',
    patientInitials: 'ML',
    requestedEquipment: 'Custom power wheelchair',
    equipmentCategory: 'Mobility',
    insurerName: 'Meridian Demo Health',
    insurerPlan: 'Power Mobility Plan',
    status: 'Ready for Submission',
    priority: 'Routine',
    assignedSpecialist: 'Maya Chen',
    followUpDue: '2026-09-07',
    createdAt: '2026-08-22T14:10:00.000Z',
    updatedAt: '2026-09-05T15:26:00.000Z',
    checklistOverrides: { OTHER: 'Not Required' },
  },
  {
    id: 'RM-PA-1046',
    patientDisplayName: 'Priya Nair',
    patientInitials: 'PN',
    requestedEquipment: 'Continuous glucose monitor',
    equipmentCategory: 'Diabetes supplies',
    insurerName: 'UnitedHealthcare',
    insurerPlan: 'Choice Plus',
    status: 'Submitted',
    priority: 'Routine',
    assignedSpecialist: 'Owen Patel',
    followUpDue: '2026-09-08',
    createdAt: '2026-08-25T16:30:00.000Z',
    updatedAt: '2026-09-05T15:00:00.000Z',
    checklistOverrides: {
      PT_OT_EVALUATION: 'Not Required',
      OTHER: 'Not Required',
    },
  },
  {
    id: 'RM-PA-1045',
    patientDisplayName: 'Daniel Brooks',
    patientInitials: 'DB',
    requestedEquipment: 'Portable oxygen concentrator',
    equipmentCategory: 'Respiratory',
    insurerName: 'Humana',
    insurerPlan: 'ChoiceCare PPO',
    status: 'Pending',
    priority: 'High',
    assignedSpecialist: 'Owen Patel',
    followUpDue: '2026-09-05',
    createdAt: '2026-08-20T13:40:00.000Z',
    updatedAt: '2026-09-05T14:00:00.000Z',
    checklistOverrides: {
      PT_OT_EVALUATION: 'Not Required',
      OTHER: 'Not Required',
    },
  },
  {
    id: 'RM-PA-1044',
    patientDisplayName: 'Sophia Bennett',
    patientInitials: 'SB',
    requestedEquipment: 'CPAP device',
    equipmentCategory: 'Respiratory',
    insurerName: 'Cigna',
    insurerPlan: 'Open Access Plus',
    status: 'Needs Documentation',
    priority: 'Routine',
    assignedSpecialist: 'Maya Chen',
    followUpDue: '2026-09-06',
    createdAt: '2026-08-29T17:10:00.000Z',
    updatedAt: '2026-09-05T13:00:00.000Z',
    checklistOverrides: {
      PHYSICIAN_ORDER: 'Missing',
      PT_OT_EVALUATION: 'Not Required',
      OTHER: 'Not Required',
    },
  },
  {
    id: 'RM-PA-1043',
    patientDisplayName: 'Jordan Kim',
    patientInitials: 'JK',
    requestedEquipment: 'Power mobility scooter',
    equipmentCategory: 'Mobility',
    insurerName: 'State Medicaid',
    insurerPlan: 'DME Benefit',
    status: 'Approved',
    priority: 'Routine',
    assignedSpecialist: 'Owen Patel',
    followUpDue: null,
    createdAt: '2026-08-18T14:45:00.000Z',
    updatedAt: '2026-09-04T17:10:00.000Z',
    checklistOverrides: { OTHER: 'Not Required' },
  },
  {
    id: 'RM-PA-1042',
    patientDisplayName: 'Amira Hassan',
    patientInitials: 'AH',
    requestedEquipment: 'Insulin pump',
    equipmentCategory: 'Diabetes supplies',
    insurerName: 'SummitCare Advantage',
    insurerPlan: 'Advantage DME Plan',
    status: 'Denied',
    priority: 'Urgent',
    assignedSpecialist: 'Maya Chen',
    followUpDue: '2026-09-09',
    createdAt: '2026-08-19T15:05:00.000Z',
    updatedAt: '2026-09-04T15:35:00.000Z',
    checklistOverrides: {
      PT_OT_EVALUATION: 'Not Required',
      SUPPORTING_DOCUMENTATION: 'Needs Review',
      OTHER: 'Not Required',
    },
  },
  {
    id: 'RM-PA-1041',
    patientDisplayName: 'Theo Martin',
    patientInitials: 'TM',
    requestedEquipment: 'Custom knee orthosis',
    equipmentCategory: 'Orthotics',
    insurerName: 'Aetna',
    insurerPlan: 'Choice POS II',
    status: 'Appeal Drafting',
    priority: 'High',
    assignedSpecialist: 'Owen Patel',
    followUpDue: '2026-09-05',
    createdAt: '2026-08-14T14:15:00.000Z',
    updatedAt: '2026-09-03T16:20:00.000Z',
    checklistOverrides: { PT_OT_EVALUATION: 'Missing', OTHER: 'Not Required' },
  },
  {
    id: 'RM-PA-1040',
    patientDisplayName: 'Grace Wong',
    patientInitials: 'GW',
    requestedEquipment: 'Ambulatory infusion pump',
    equipmentCategory: 'Infusion therapy',
    insurerName: 'Medicare',
    insurerPlan: 'Traditional Medicare',
    status: 'Draft',
    priority: 'Routine',
    assignedSpecialist: 'Maya Chen',
    followUpDue: '2026-09-10',
    createdAt: '2026-09-01T15:00:00.000Z',
    updatedAt: '2026-09-03T14:10:00.000Z',
    checklistOverrides: {
      PHYSICIAN_ORDER: 'Missing',
      CLINICAL_CHART_NOTES: 'Missing',
      SUPPORTING_DOCUMENTATION: 'Missing',
      PT_OT_EVALUATION: 'Not Required',
      OTHER: 'Not Required',
    },
  },
];

export type SyntheticDocumentSeed = {
  id: string;
  caseId: string;
  documentType: DocumentationType;
  originalFilename: string;
  storedFilename: string;
  reviewStatus: DocumentReviewStatus;
  content: string;
};

export const syntheticDocumentSeeds: SyntheticDocumentSeed[] = [
  {
    id: '4e2e7ac4-f42f-4acd-af67-8ab18ccdb101',
    caseId: 'RM-PA-1047',
    documentType: 'PHYSICIAN_ORDER',
    originalFilename: 'sample-physician-order.txt',
    storedFilename: 'cb81f51e-40b5-46d5-b13a-25fd2d849101.txt',
    reviewStatus: 'Reviewed',
    content:
      'SYNTHETIC DEMO DOCUMENT — NOT A REAL PATIENT RECORD\n\nSample physician order for a custom power wheelchair. Created only for the Reliable Medical case-study prototype.\n',
  },
  {
    id: '4e2e7ac4-f42f-4acd-af67-8ab18ccdb102',
    caseId: 'RM-PA-1047',
    documentType: 'PT_OT_EVALUATION',
    originalFilename: 'sample-mobility-evaluation.txt',
    storedFilename: 'cb81f51e-40b5-46d5-b13a-25fd2d849102.txt',
    reviewStatus: 'Reviewed',
    content:
      'SYNTHETIC DEMO DOCUMENT — NOT A REAL PATIENT RECORD\n\nSample mobility evaluation placeholder. No medical conclusions or real clinical data are included.\n',
  },
  {
    id: '4e2e7ac4-f42f-4acd-af67-8ab18ccdb103',
    caseId: 'RM-PA-1048',
    documentType: 'PATIENT_DEMOGRAPHICS',
    originalFilename: 'sample-demographics.txt',
    storedFilename: 'cb81f51e-40b5-46d5-b13a-25fd2d849103.txt',
    reviewStatus: 'Reviewed',
    content:
      'SYNTHETIC DEMO DOCUMENT — NOT A REAL PATIENT RECORD\n\nFictional demographics placeholder for workflow demonstration only.\n',
  },
  {
    id: '4e2e7ac4-f42f-4acd-af67-8ab18ccdb104',
    caseId: 'RM-PA-1048',
    documentType: 'INSURANCE_INFORMATION',
    originalFilename: 'sample-insurance-summary.txt',
    storedFilename: 'cb81f51e-40b5-46d5-b13a-25fd2d849104.txt',
    reviewStatus: 'Needs Review',
    content:
      'SYNTHETIC DEMO DOCUMENT — NOT A REAL INSURANCE RECORD\n\nFictional Aetna plan summary for interface demonstration only.\n',
  },
  {
    id: '4e2e7ac4-f42f-4acd-af67-8ab18ccdb105',
    caseId: 'RM-PA-1042',
    documentType: 'OTHER',
    originalFilename: 'sample-denial-notice.txt',
    storedFilename: 'cb81f51e-40b5-46d5-b13a-25fd2d849105.txt',
    reviewStatus: 'Reviewed',
    content:
      'SYNTHETIC DEMO DOCUMENT — NOT A REAL COVERAGE DECISION\n\nFictional denial-notice placeholder retained for a future appeal workflow. No coverage determination is represented.\n',
  },
  {
    id: '4e2e7ac4-f42f-4acd-af67-8ab18ccdb106',
    caseId: 'RM-PA-1042',
    documentType: 'PHYSICIAN_ORDER',
    originalFilename: 'sample-pump-order.txt',
    storedFilename: 'cb81f51e-40b5-46d5-b13a-25fd2d849106.txt',
    reviewStatus: 'Reviewed',
    content:
      'SYNTHETIC DEMO DOCUMENT — NOT A REAL PATIENT RECORD\n\nSample equipment order for an insulin pump. Fictional content for workflow testing only.\n',
  },
];

export const syntheticNoteSeeds = [
  {
    id: 'e7a02b0c-80f4-4dad-8c20-6b0ccbc8e101',
    caseId: 'RM-PA-1048',
    body: 'Synthetic note: requested the two outstanding documentation items for workflow demonstration.',
    createdAt: '2026-09-05T15:35:00.000Z',
  },
  {
    id: 'e7a02b0c-80f4-4dad-8c20-6b0ccbc8e102',
    caseId: 'RM-PA-1047',
    body: 'Synthetic note: intake checklist reviewed and the case is ready for human submission review.',
    createdAt: '2026-09-05T15:12:00.000Z',
  },
  {
    id: 'e7a02b0c-80f4-4dad-8c20-6b0ccbc8e103',
    caseId: 'RM-PA-1042',
    body: 'Synthetic note: denial notice received and retained for a future, separately reviewed appeal workflow.',
    createdAt: '2026-09-04T15:40:00.000Z',
  },
] as const;
