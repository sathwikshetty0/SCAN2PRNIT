// =============================================================================
// SERVER ONLY — DO NOT IMPORT FROM CLIENT COMPONENTS OR CLIENT-SIDE CODE
// This module uses SUPABASE_SERVICE_ROLE_KEY which bypasses Row Level Security.
// Exposing this key to the browser would allow any user to read/write all data.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with service role privileges for use in server-side
 * code only (API routes, server actions, webhook handlers).
 *
 * The service role key bypasses RLS — only call this from trusted server code.
 * Uses SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix — never sent to the browser).
 *
 * Requirements: 13.2, 9.4
 */
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // Disable automatic session persistence — server clients are stateless
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
