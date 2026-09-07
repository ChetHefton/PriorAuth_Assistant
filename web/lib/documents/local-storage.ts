import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { MAX_DOCUMENT_BYTES } from '@/lib/documents/config';

type ValidatedDocument = {
  id: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSize: number;
};

type DetectedType = {
  mimeType: string;
  extension: string;
  acceptedExtensions: string[];
};

export class DocumentUploadError extends Error {}

function uploadDirectory(): string {
  return path.join(process.cwd(), 'data', 'local', 'uploads');
}

function sanitizeOriginalFilename(filename: string, extension: string): string {
  const basename = path.basename(filename).normalize('NFKC');
  const cleaned = basename
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim();
  return cleaned || `synthetic-document${extension}`;
}

function startsWith(buffer: Buffer, signature: number[]): boolean {
  return signature.every((byte, index) => buffer[index] === byte);
}

function detectFileType(buffer: Buffer): DetectedType | null {
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return {
      mimeType: 'application/pdf',
      extension: '.pdf',
      acceptedExtensions: ['.pdf'],
    };
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return {
      mimeType: 'image/png',
      extension: '.png',
      acceptedExtensions: ['.png'],
    };
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return {
      mimeType: 'image/jpeg',
      extension: '.jpg',
      acceptedExtensions: ['.jpg', '.jpeg'],
    };
  }
  const prefix = buffer.subarray(0, 6).toString('ascii');
  if (prefix === 'GIF87a' || prefix === 'GIF89a') {
    return {
      mimeType: 'image/gif',
      extension: '.gif',
      acceptedExtensions: ['.gif'],
    };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return {
      mimeType: 'image/webp',
      extension: '.webp',
      acceptedExtensions: ['.webp'],
    };
  }
  if (!buffer.includes(0)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      return {
        mimeType: 'text/plain',
        extension: '.txt',
        acceptedExtensions: ['.txt'],
      };
    } catch {
      return null;
    }
  }
  return null;
}

export async function validateAndStoreDocument(
  file: File,
): Promise<ValidatedDocument> {
  if (file.size < 1)
    throw new DocumentUploadError('Choose a non-empty document.');
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new DocumentUploadError('Documents must be 10 MB or smaller.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectFileType(buffer);
  if (!detected) {
    throw new DocumentUploadError(
      'Upload a PDF, TXT, PNG, JPG, GIF, or WebP file.',
    );
  }

  const suppliedExtension = path.extname(file.name).toLowerCase();
  if (!detected.acceptedExtensions.includes(suppliedExtension)) {
    throw new DocumentUploadError(
      'The document extension does not match its contents.',
    );
  }

  const id = randomUUID();
  const storedFilename = `${randomUUID()}${detected.extension}`;
  const directory = uploadDirectory();
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, storedFilename), buffer, { flag: 'wx' });

  return {
    id,
    originalFilename: sanitizeOriginalFilename(file.name, detected.extension),
    storedFilename,
    mimeType: detected.mimeType,
    fileSize: buffer.byteLength,
  };
}

export async function removeStoredDocument(
  storedFilename: string,
): Promise<void> {
  if (path.basename(storedFilename) !== storedFilename) return;
  await unlink(path.join(uploadDirectory(), storedFilename)).catch(
    () => undefined,
  );
}
