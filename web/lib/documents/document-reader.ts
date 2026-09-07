import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { CaseDocumentRecord } from '@/db/schema';

export const MAX_ANALYSIS_TEXT_BYTES = 256 * 1024;

export class DocumentReadError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'UNSUPPORTED_FILE_TYPE'
      | 'DOCUMENT_TOO_LARGE'
      | 'DOCUMENT_UNAVAILABLE',
  ) {
    super(message);
  }
}

function uploadDirectory(): string {
  return path.resolve(process.cwd(), 'data', 'local', 'uploads');
}

export async function readDocumentText(
  document: CaseDocumentRecord,
): Promise<string> {
  if (document.mimeType !== 'text/plain') {
    throw new DocumentReadError(
      'AI analysis currently supports TXT documents only.',
      'UNSUPPORTED_FILE_TYPE',
    );
  }
  if (document.fileSize > MAX_ANALYSIS_TEXT_BYTES) {
    throw new DocumentReadError(
      'This TXT document is too large for analysis.',
      'DOCUMENT_TOO_LARGE',
    );
  }
  if (path.basename(document.storedFilename) !== document.storedFilename) {
    throw new DocumentReadError(
      'The selected document is unavailable.',
      'DOCUMENT_UNAVAILABLE',
    );
  }

  const root = uploadDirectory();
  const resolved = path.resolve(root, document.storedFilename);
  if (path.dirname(resolved) !== root) {
    throw new DocumentReadError(
      'The selected document is unavailable.',
      'DOCUMENT_UNAVAILABLE',
    );
  }

  try {
    const text = await readFile(resolved, 'utf8');
    if (Buffer.byteLength(text, 'utf8') > MAX_ANALYSIS_TEXT_BYTES) {
      throw new DocumentReadError(
        'This TXT document is too large for analysis.',
        'DOCUMENT_TOO_LARGE',
      );
    }
    return text;
  } catch (error) {
    if (error instanceof DocumentReadError) throw error;
    throw new DocumentReadError(
      'The selected document is unavailable.',
      'DOCUMENT_UNAVAILABLE',
    );
  }
}
