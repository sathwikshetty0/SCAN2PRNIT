import { NextRequest, NextResponse } from 'next/server';
import { matchesAdminPin, setAdminSession } from '@/lib/admin-auth';

const LOCKOUT_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attemptsByAddress = new Map<string, { count: number; lockedUntil: number }>();

function requestAddress(request: NextRequest) {
  return request.ip
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(request: NextRequest) {
  if (!process.env.ADMIN_PIN) {
    return NextResponse.json({ error: 'ADMIN_PIN is not configured on the server' }, { status: 503 });
  }

  const address = requestAddress(request);
  const attempts = attemptsByAddress.get(address);
  if (attempts?.lockedUntil && attempts.lockedUntil > Date.now()) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 10 minutes.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((attempts.lockedUntil - Date.now()) / 1000)) } },
    );
  }

  let pin: unknown;
  try {
    ({ pin } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid login request' }, { status: 400 });
  }

  if (!matchesAdminPin(pin)) {
    const count = (attempts?.lockedUntil && attempts.lockedUntil <= Date.now() ? 0 : attempts?.count ?? 0) + 1;
    attemptsByAddress.set(address, {
      count,
      lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
    });
    return NextResponse.json(
      { error: count >= MAX_ATTEMPTS ? 'Too many attempts. Try again in 10 minutes.' : 'Incorrect PIN' },
      { status: count >= MAX_ATTEMPTS ? 429 : 401 },
    );
  }

  attemptsByAddress.delete(address);
  const response = NextResponse.json({ ok: true });
  try {
    setAdminSession(response);
  } catch (error) {
    console.error('[admin/login] session setup failed:', error);
    return NextResponse.json({ error: 'Admin session is not configured' }, { status: 503 });
  }
  return response;
}
