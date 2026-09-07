import type {
  CaseDraftNotes,
  DraftSummaryProviderInput,
} from '@/types/prior-auth-draft';

export interface CaseDraftSummaryProvider {
  readonly providerName: string;
  readonly modelName: string;
  summarize(input: DraftSummaryProviderInput): Promise<unknown>;
}

export type { CaseDraftNotes };
