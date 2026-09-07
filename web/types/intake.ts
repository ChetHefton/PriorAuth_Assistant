export type IntakeField={key:string;label:string;value:string|null;confidence:'HIGH'|'MEDIUM'|'LOW';sourceFilename:string|null;sourceQuote:string|null;needsReview:boolean};
export type CaseIntake={id:string;createdByUserId:string;status:'UPLOADING'|'PROPOSED'|'CREATED';fields:IntakeField[];documentCount:number;duplicateWarnings:string[]};
