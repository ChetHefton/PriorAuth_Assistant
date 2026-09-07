import { z } from 'zod';

import {
  detectedDocumentTypes,
  extractionConfidences,
  extractionEvidenceStatuses,
  extractionFactKeys,
  type ModelExtractionOutput,
} from '@/types/extraction';

const modelFactSchema = z
  .object({
    value: z.string().trim().min(1).max(1_000).nullable(),
    confidence: z.enum(extractionConfidences),
    evidenceStatus: z.enum(extractionEvidenceStatuses),
    sourceQuote: z.string().trim().min(1).max(240).nullable(),
    uncertaintyNote: z.string().trim().min(1).max(300).nullable(),
  })
  .strict();

const factShape = Object.fromEntries(
  extractionFactKeys.map((key) => [key, modelFactSchema]),
) as Record<(typeof extractionFactKeys)[number], typeof modelFactSchema>;

export const modelExtractionSchema = z
  .object({
    classification: z
      .object({
        documentType: z.enum(detectedDocumentTypes),
        confidence: z.enum(extractionConfidences),
        sourceQuote: z.string().trim().min(1).max(240).nullable(),
        needsReview: z.boolean(),
      })
      .strict(),
    warnings: z.array(z.string().trim().min(1).max(240)).max(12),
    facts: z.object(factShape).strict(),
  })
  .strict();

export function parseModelExtractionOutput(
  value: unknown,
): ModelExtractionOutput {
  return modelExtractionSchema.parse(value);
}

export class ExtractionGroundingError extends Error {
  constructor() {
    super('The model response could not be grounded in the selected document.');
  }
}

function normalizeEvidence(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function quoteIsPresent(sourceText: string, quote: string): boolean {
  return normalizeEvidence(sourceText).includes(normalizeEvidence(quote));
}

function assertHcpcsGrounding(value: string, quote: string): void {
  const codes = value.toUpperCase().match(/\b[A-Z]\d{4}\b/g);
  if (!codes?.length) throw new ExtractionGroundingError();
  const normalizedQuote = quote.toUpperCase();
  if (codes.some((code) => !normalizedQuote.includes(code))) {
    throw new ExtractionGroundingError();
  }
}

export function assertGroundedExtraction(
  output: ModelExtractionOutput,
  sourceText: string,
): void {
  const classification = output.classification;
  if (classification.documentType !== 'Other / Unknown') {
    if (
      !classification.sourceQuote ||
      !quoteIsPresent(sourceText, classification.sourceQuote)
    ) {
      throw new ExtractionGroundingError();
    }
  } else if (
    classification.sourceQuote &&
    !quoteIsPresent(sourceText, classification.sourceQuote)
  ) {
    throw new ExtractionGroundingError();
  }

  for (const key of extractionFactKeys) {
    const fact = output.facts[key];
    if (fact.value === null) {
      if (fact.evidenceStatus !== 'NOT_FOUND' || fact.sourceQuote !== null) {
        throw new ExtractionGroundingError();
      }
      continue;
    }

    if (
      fact.evidenceStatus === 'NOT_FOUND' ||
      !fact.sourceQuote ||
      !quoteIsPresent(sourceText, fact.sourceQuote)
    ) {
      throw new ExtractionGroundingError();
    }

    if (key === 'hcpcsCodes') {
      assertHcpcsGrounding(fact.value, fact.sourceQuote);
    }
  }
}
