import { NextRequest, NextResponse } from 'next/server';

import { recordAuditEvent } from '@/db/repositories/audit-events';
import { findUserByUsername } from '@/db/repositories/users';
import { verifyPassword } from '@/lib/auth/passwords';
import { isSameOriginRequest } from '@/lib/auth/request-authorization';
import {
  createSession,
  deleteExpiredSessions,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/sessions';
import { loginSchema } from '@/lib/auth/validation';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'Request origin could not be verified.' },
      { status: 403 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid username or password.' },
      { status: 400 },
    );
  }

  deleteExpiredSessions();
  const user = findUserByUsername(parsed.data.username);
  const passwordMatches = user
    ? await verifyPassword(user.passwordHash, parsed.data.password)
    : false;

  if (!user || !user.isActive || !passwordMatches) {
    return NextResponse.json(
      { error: 'Invalid username or password.' },
      { status: 401 },
    );
  }

  const session = createSession(user.id);
  recordAuditEvent({
    userId: user.id,
    action: 'auth.login',
    resourceType: 'session',
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: session.expiresAt,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
