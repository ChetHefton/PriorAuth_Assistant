import { NextRequest, NextResponse } from 'next/server';

import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  getRequestUser,
  isSameOriginRequest,
} from '@/lib/auth/request-authorization';
import { deleteSession, SESSION_COOKIE_NAME } from '@/lib/auth/sessions';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: 'Request origin could not be verified.' },
      { status: 403 },
    );
  }

  const user = getRequestUser(request);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    deleteSession(token);
  }

  if (user) {
    recordAuditEvent({
      userId: user.id,
      action: 'auth.logout',
      resourceType: 'session',
    });
  }

  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
