import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE = 'scan2print_admin';
const SESSION_SECONDS = 30 * 60;

function sessionSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin sessions');
  return secret;
}

function sign(expiry: string) {
  return createHmac('sha256', sessionSecret()).update(expiry).digest('base64url');
}

export function setAdminSession(response: NextResponse) {
  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  response.cookies.set(ADMIN_COOKIE, `${expiry}.${sign(expiry)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: SESSION_SECONDS,
  });
}

export function clearAdminSession(response: NextResponse) {
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: 0,
  });
}

export function requireAdmin(request: NextRequest) {
  const value = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!value) return NextResponse.json({ error: 'Admin login required' }, { status: 401 });

  const [expiry, signature, ...extra] = value.split('.');
  if (!expiry || !signature || extra.length || Number(expiry) <= Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: 'Admin session expired' }, { status: 401 });
  }

  const expected = Buffer.from(sign(expiry));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: 'Invalid admin session' }, { status: 401 });
  }

  return null;
}

export function matchesAdminPin(candidate: unknown) {
  const expectedPin = process.env.ADMIN_PIN;
  if (!expectedPin || typeof candidate !== 'string') return false;

  const expected = Buffer.from(expectedPin);
  const received = Buffer.from(candidate);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
