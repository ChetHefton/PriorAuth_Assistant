import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import { getDatabase } from '@/db/client';
import { caseIntakeDocuments, caseIntakes } from '@/db/schema';
import { listCases } from '@/db/repositories/cases';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { getRequestUser } from '@/lib/auth/request-authorization';
import { promoteIntakeToCase } from '@/lib/cases/intake-service';

type IntakeField = { key: string; label: string; value: string | null; confidence: string; sourceFilename: string | null; sourceQuote: string | null; needsReview: boolean };
const currentUser = (request: Request) => getRequestUser(request as NextRequest);
export const intakeErrorResponse = (error: unknown) => NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to complete document intake.' }, { status: 500, headers: { 'Content-Type': 'application/json' } });

function propose(files: Array<{ name: string; text: string }>): IntakeField[] {
  const all = files.map((file) => file.text).join('\n');
  const find = (expression: RegExp) => all.match(expression)?.[1]?.trim() ?? null;
  const source = (expression: RegExp) => files.find((file) => expression.test(file.name))?.name ?? null;
  return [
    { key: 'patientName', label: 'Patient name', value: find(/Patient:\s*([^\n]+)/i), confidence: 'HIGH', sourceFilename: source(/demographic/i), sourceQuote: null, needsReview: false },
    { key: 'dateOfBirth', label: 'Date of birth', value: find(/(?:Date of birth|DOB):\s*([^\n]+)/i), confidence: 'HIGH', sourceFilename: source(/demographic/i), sourceQuote: null, needsReview: false },
    { key: 'memberPolicyId', label: 'Member / policy ID', value: find(/(?:Member ID|Policy ID):\s*([^\n]+)/i), confidence: 'HIGH', sourceFilename: source(/insurance/i), sourceQuote: null, needsReview: false },
    { key: 'payer', label: 'Payer', value: find(/Payer:\s*([^\n]+)/i), confidence: 'HIGH', sourceFilename: source(/insurance/i), sourceQuote: null, needsReview: false },
    { key: 'plan', label: 'Plan', value: find(/Plan:\s*([^\n]+)/i), confidence: 'HIGH', sourceFilename: source(/insurance/i), sourceQuote: null, needsReview: false },
    { key: 'orderingProvider', label: 'Ordering provider', value: find(/Ordering provider:\s*([^\n]+)/i), confidence: 'HIGH', sourceFilename: source(/order/i), sourceQuote: null, needsReview: false },
    { key: 'requestedEquipment', label: 'Requested equipment', value: find(/(?:Requested equipment|Equipment):\s*([^\n]+)/i), confidence: 'MEDIUM', sourceFilename: source(/equipment|order/i), sourceQuote: null, needsReview: true },
  ];
}

export async function POST(request: Request) {
  try {
    const user = currentUser(request);
    if (!user || !user.permissions.includes('cases.write')) return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
    const form = await request.formData();
    const files = form.getAll('files').filter((value): value is File => value instanceof File);
    if (!files.length) return NextResponse.json({ success: false, error: 'Upload at least one document.' }, { status: 400 });
    const intakeId = randomUUID();
    const root = path.join(process.cwd(), 'data', 'local', 'intakes', intakeId);
    await mkdir(root, { recursive: true });
    const parsed: Array<{ name: string; text: string }> = [];
    const staged: Array<{ originalFilename: string; storedFilename: string; mimeType: string; fileSize: number }> = [];
    for (const file of files) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const stored = `${randomUUID()}-${safe}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(root, stored), bytes);
      parsed.push({ name: file.name, text: file.type === 'text/plain' ? bytes.toString('utf8') : '' });
      staged.push({ originalFilename: file.name, storedFilename: path.join('data/local/intakes', intakeId, stored), mimeType: file.type || 'application/octet-stream', fileSize: file.size });
    }
    const fields = propose(parsed);
    const db = getDatabase();
    const member = fields.find((field) => field.key === 'memberPolicyId')?.value;
    const duplicateWarnings = member ? listCases(db).filter((item) => item.id.includes(member)).map((item) => `Possible duplicate: ${item.id}`) : [];
    db.transaction((transaction) => {
      transaction.insert(caseIntakes).values({ id: intakeId, createdByUserId: user.id, status: 'PROPOSED', fieldsJson: JSON.stringify(fields), createdAt: new Date() }).run();
      for (const file of staged) transaction.insert(caseIntakeDocuments).values({ id: randomUUID(), intakeId, ...file, createdAt: new Date() }).run();
      recordAuditEvent({ userId: user.id, action: 'case.intake_started', resourceType: 'case_intake', resourceId: intakeId }, transaction);
    });
    return NextResponse.json({ success: true, intakeId, fields, duplicateWarnings }, { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return intakeErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = currentUser(request);
    if (!user || !user.permissions.includes('cases.write')) return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
    const body = await request.json() as { intakeId: string; fields: Array<{ key: string; value: string | null }>; assignToSelf?: boolean };
    const db = getDatabase();
    const intake = db.select().from(caseIntakes).where(eq(caseIntakes.id, body.intakeId)).get();
    if (!intake) return NextResponse.json({ success: false, error: 'Intake not found.' }, { status: 404 });
    if (intake.status === 'CREATED' && intake.createdCaseId) return NextResponse.json({ success: true, caseId: intake.createdCaseId }, { headers: { 'Content-Type': 'application/json' } });
    const fields = JSON.parse(intake.fieldsJson) as Array<Record<string, unknown>>;
    for (const update of body.fields) {
      const field = fields.find((item) => item.key === update.key);
      if (field) field.value = update.value;
    }
    const caseId = await promoteIntakeToCase({ db, intakeId: body.intakeId, fields: fields as Array<{ key: string; value: unknown }>, userId: user.id, userDisplayName: user.displayName, assignToSelf: body.assignToSelf });
    try {
      await rm(path.join(process.cwd(), 'data', 'local', 'intakes', body.intakeId), { recursive: true, force: true });
    } catch {
      // The case and its permanent documents are already committed; cleanup is best effort.
    }
    return NextResponse.json({ success: true, caseId }, { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return intakeErrorResponse(error);
  }
}
