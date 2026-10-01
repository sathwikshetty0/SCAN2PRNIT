/**
 * @jest-environment node
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchesAdminPin, requireAdmin, setAdminSession } from '../admin-auth';

describe('admin authentication', () => {
  const originalPin = process.env.ADMIN_PIN;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.ADMIN_PIN = '6482';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterAll(() => {
    if (originalPin === undefined) delete process.env.ADMIN_PIN;
    else process.env.ADMIN_PIN = originalPin;
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  });

  it('compares the configured PIN without accepting a missing value', () => {
    expect(matchesAdminPin('6482')).toBe(true);
    expect(matchesAdminPin('1234')).toBe(false);
    expect(matchesAdminPin(undefined)).toBe(false);
  });

  it('accepts a signed, unexpired admin session', () => {
    const response = NextResponse.json({ ok: true });
    setAdminSession(response);
    const cookie = response.cookies.get('scan2print_admin');
    const request = new NextRequest('http://localhost/api/admin/jobs', {
      headers: { cookie: `scan2print_admin=${cookie?.value}` },
    });

    expect(requireAdmin(request)).toBeNull();
  });

  it('rejects a modified admin session cookie', () => {
    const request = new NextRequest('http://localhost/api/admin/jobs', {
      headers: { cookie: 'scan2print_admin=9999999999.invalid' },
    });

    expect(requireAdmin(request)?.status).toBe(401);
  });
});
