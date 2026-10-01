import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, setAdminSession } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const response = NextResponse.json({ ok: true });
  setAdminSession(response);
  return response;
}
