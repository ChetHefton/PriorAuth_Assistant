export type DocumentAnalysisProviderInput = {
  documentText: string;
};

export interface DocumentAnalysisProvider {
  readonly providerName: string;
  readonly modelName: string;
  extract(input: DocumentAnalysisProviderInput): Promise<unknown>;
}
