import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  findUserById,
  toManagedUser,
  updateUser,
} from '@/db/repositories/users';
import { hashPassword } from '@/lib/auth/passwords';
import {
  isSameOriginRequest,
  requestUserHasPermission,
} from '@/lib/auth/request-authorization';
import { updateUserSchema } from '@/lib/auth/validation';

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'Request origin could not be verified.' },
      { status: 403 },
    );
  }

  const actor = requestUserHasPermission(request, 'users.manage');
  if (!actor) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { userId } = await context.params;
  if (!z.uuid().safeParse(userId).success) {
    return NextResponse.json(
      { error: 'Invalid user identifier.' },
      { status: 400 },
    );
  }

  const existing = findUserById(userId);
  if (!existing) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid user changes.' },
      { status: 400 },
    );
  }

  if (
    actor.id === userId &&
    (parsed.data.isActive === false ||
      (parsed.data.role !== undefined && parsed.data.role !== 'ADMIN') ||
      parsed.data.password !== undefined)
  ) {
    return NextResponse.json(
      {
        error:
          'Use another administrator account to change your own access or password.',
      },
      { status: 400 },
    );
  }

  const passwordHash = parsed.data.password
    ? await hashPassword(parsed.data.password)
    : undefined;
  const updated = updateUser(userId, {
    displayName: parsed.data.displayName,
    role: parsed.data.role,
    isActive: parsed.data.isActive,
    passwordHash,
  });

  if (!updated) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  recordAuditEvent({
    userId: actor.id,
    action: passwordHash ? 'users.password_reset' : 'users.update',
    resourceType: 'user',
    resourceId: updated.id,
  });

  const response = NextResponse.json({ user: toManagedUser(updated) });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
