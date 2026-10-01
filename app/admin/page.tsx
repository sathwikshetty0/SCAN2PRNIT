'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PrintJob } from '@/types/print-job';
import { createClient } from '@/lib/supabase/client';

/* ─── Types ──────────────────────────────────────────────── */
interface PrinterStatus {
  id: string;
  updated_at: string;
  is_online: boolean;
  error_type: string | null;
  error_message: string | null;
  printer_name: string | null;
}

interface Stats {
  totalRevenue: number;
  todayRevenue: number;
  totalJobs: number;
  todayJobs: number;
  totalPages: number;
  failedJobs: number;
  printingJobs: number;
}

interface PaperInventory {
  remaining_sheets: number | null;
  updated_at?: string;
}

/* ─── PIN Gate ───────────────────────────────────────────── */
function PinLogin({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);
  const [locked, setLocked] = useState(false);

  const submit = async () => {
    if (locked) return;
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const body = await response.json();
      if (!response.ok) {
        const message = body.error ?? 'Admin login failed';
        if (response.status === 401 || response.status === 429) {
          const next = tries + 1;
          setTries(next);
          setPin('');
          if (response.status === 429 || next >= 5) {
            setLocked(true);
            setError(message);
            setTimeout(() => { setLocked(false); setTries(0); setError(''); }, 600_000);
          } else {
            setError(`${message} (${5 - next} attempt${5 - next === 1 ? '' : 's'} left)`);
          }
        } else {
          setError(message);
        }
        return;
      }
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Admin login failed';
      setError(message);
    }
  };

  return (
    <div data-admin-dashboard style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24, padding: '48px 40px', width: 360, textAlign: 'center',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', boxShadow: '0 0 32px rgba(79,70,229,0.4)',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>
          Admin Portal
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', marginBottom: 32 }}>
          Enter your PIN to access the dashboard
        </p>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Enter PIN"
          disabled={locked}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: '1.25rem', textAlign: 'center', letterSpacing: '0.3em',
            outline: 'none', marginBottom: 16, fontFamily: 'monospace',
          }}
        />

        {error && (
          <p style={{ color: '#f87171', fontSize: '0.8rem', marginBottom: 16 }}>{error}</p>
        )}

        <button
          onClick={submit}
          disabled={locked || pin.length < 4}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: pin.length >= 4 && !locked
              ? 'linear-gradient(135deg, #4F46E5, #7C3AED)'
              : 'rgba(255,255,255,0.1)',
            color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: pin.length >= 4 && !locked ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {locked ? '🔒 Locked' : 'Unlock Dashboard'}
        </button>
      </div>
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ─── Stat Card ──────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, color = '#4F46E5' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ─── Printer Status Banner ──────────────────────────────── */
function PrinterBanner({ ps }: { ps: PrinterStatus | null }) {
  if (!ps) return (
    <div style={{
      background: 'rgba(107,114,128,0.15)', border: '1px solid rgba(107,114,128,0.3)',
      borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6B7280' }} />
      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
        Printer status unknown — print controller not running
      </span>
    </div>
  );

  const isOk   = ps.is_online && !ps.error_type;
  const isWarn = ps.is_online && ps.error_type === 'ink_low';
  const isErr  = !ps.is_online || (ps.error_type && ps.error_type !== 'ink_low');

  const dot  = isOk ? '#4ADE80' : isWarn ? '#FBBF24' : '#EF4444';
  const bg   = isOk ? 'rgba(74,222,128,0.08)' : isWarn ? 'rgba(251,191,36,0.08)' : 'rgba(239,68,68,0.08)';
  const bdr  = isOk ? 'rgba(74,222,128,0.25)' : isWarn ? 'rgba(251,191,36,0.25)' : 'rgba(239,68,68,0.25)';

  const label = isOk
    ? `✓ Printer Ready  —  ${ps.printer_name}`
    : `⚠ ${ps.error_message ?? ps.error_type}  —  ${ps.printer_name}`;

  return (
    <div style={{
      background: bg, border: `1px solid ${bdr}`, borderRadius: 12,
      padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: dot,
          boxShadow: `0 0 8px ${dot}`, animation: isErr ? 'pulse 1.5s ease-in-out infinite' : 'none'
        }} />
        <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
        Updated {timeAgo(ps.updated_at)}
      </span>
    </div>
  );
}

function PaperInventoryCard({
  inventory,
  onUpdated,
}: {
  inventory: PaperInventory | null;
  onUpdated: () => void;
}) {
  const [sheets, setSheets] = useState('');
  const [mode, setMode] = useState<'initial' | 'refill' | 'waste'>(
    inventory?.remaining_sheets == null ? 'initial' : 'refill',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const remaining = inventory?.remaining_sheets;

  useEffect(() => {
    setMode(remaining == null ? 'initial' : 'refill');
  }, [remaining]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/paper-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, sheets: Number(sheets) }),
      });
      const body = await response.json();
      if (!response.ok && !body.inventory) throw new Error(body.error ?? 'Inventory update failed');
      setSheets('');
      setMessage(body.warning ?? 'Paper inventory updated');
      onUpdated();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Inventory update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 16, display: 'flex', flexWrap: 'wrap',
      alignItems: 'center', gap: 12, marginBottom: 20,
    }}>
      <div style={{ minWidth: 180, flex: '1 1 240px' }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem' }}>Paper in tray</div>
        <strong style={{ fontSize: '1.2rem' }}>
          {remaining == null ? 'Count not set' : `${remaining} sheets`}
        </strong>
        {remaining != null && remaining <= 15 && (
          <div role="status" style={{ color: '#FBBF24', fontSize: '0.75rem' }}>Refill required soon</div>
        )}
      </div>
      {remaining != null && (
        <select
          aria-label="Paper inventory action"
          value={mode}
          onChange={event => setMode(event.target.value as 'initial' | 'refill' | 'waste')}
          style={{ minHeight: 40, borderRadius: 8, padding: '0 10px' }}
        >
          <option value="refill">Record refill</option>
          <option value="waste">Correct wasted sheets</option>
        </select>
      )}
      <input
        aria-label={mode === 'waste' ? 'Wasted sheets' : mode === 'initial' ? 'Initial sheets in tray' : 'Sheets added'}
        type="number"
        min="1"
        max="10000"
        required
        value={sheets}
        onChange={event => setSheets(event.target.value)}
        placeholder={remaining == null ? 'Initial sheets in tray' : 'Sheets'}
        style={{ width: 160, minHeight: 40, borderRadius: 8, padding: '0 10px' }}
      />
      <button disabled={busy} type="submit" style={{
        minHeight: 40, borderRadius: 8, border: 0, padding: '0 14px',
        background: '#4F46E5', color: 'white', fontWeight: 600,
        cursor: busy ? 'wait' : 'pointer',
      }}>
        {busy ? 'Saving…' : mode === 'initial' ? 'Set count' : mode === 'waste' ? 'Record waste' : 'Add refill'}
      </button>
      {message && <span role="status" style={{ flexBasis: '100%', fontSize: '0.75rem' }}>{message}</span>}
    </form>
  );
}

/* ─── Job Status Badge ───────────────────────────────────── */
function JobBadge({ type, val }: { type: 'job' | 'payment'; val: string }) {
  const cfg: Record<string, [string, string]> = {
    QUEUED:   ['#FBBF24', 'rgba(251,191,36,0.15)'],
    PRINTING: ['#818CF8', 'rgba(129,140,248,0.15)'],
    PRINTED:  ['#4ADE80', 'rgba(74,222,128,0.15)'],
    FAILED:   ['#EF4444', 'rgba(239,68,68,0.15)'],
    PAID:     ['#4ADE80', 'rgba(74,222,128,0.15)'],
    PENDING:  ['#FBBF24', 'rgba(251,191,36,0.15)'],
  };
  const [col, bg] = cfg[val] ?? ['#9CA3AF', 'rgba(156,163,175,0.15)'];
  const labels: Record<string, string> = {
    QUEUED: 'Queued', PRINTING: 'Printing', PRINTED: 'Printed', FAILED: 'Failed',
    PAID: 'Paid', PENDING: 'Pending',
  };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
      background: bg, color: col, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {labels[val] ?? val}
    </span>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────── */
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [data, setData]       = useState<{
    jobs: PrintJob[];
    printerStatus: PrinterStatus | null;
    paperInventory: PaperInventory | null;
    stats: Stats;
    kioskPaused: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [kioskPaused, setKioskPaused] = useState(false);
  const [kioskToggling, setKioskToggling] = useState(false);
  const [tgSending, setTgSending] = useState(false);
  const [tgToast, setTgToast]     = useState<{ ok: boolean; msg: string } | null>(null);

  // Idle auto-logout (A5) — 30 min idle timeout, 60s warning
  const idleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSessionRefreshRef = useRef(0);
  const [idleWarning, setIdleWarning] = useState<number | null>(null); // countdown seconds

  const refreshAdminSession = useCallback(async () => {
    if (Date.now() - lastSessionRefreshRef.current < 5 * 60 * 1_000) return;
    lastSessionRefreshRef.current = Date.now();
    try {
      const response = await fetch('/api/admin/session', { method: 'POST' });
      if (response.status === 401) {
        onLogout();
      } else if (!response.ok) {
        setError('Could not refresh admin session');
      }
    } catch {
      setError('Could not refresh admin session');
    }
  }, [onLogout]);

  const resetIdleTimer = useCallback(() => {
    void refreshAdminSession();
    if (idleTimerRef.current)    clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    setIdleWarning(null);

    // 29 min: start warning countdown
    warningTimerRef.current = setTimeout(() => {
      let remaining = 60;
      setIdleWarning(remaining);
      warningIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
          warningIntervalRef.current = null;
          setIdleWarning(null);
        } else {
          setIdleWarning(remaining);
        }
      }, 1_000);
    }, 29 * 60 * 1_000);

    // 30 min: logout
    idleTimerRef.current = setTimeout(() => {
      onLogout();
    }, 30 * 60 * 1_000);
  }, [onLogout, refreshAdminSession]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/jobs');
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (!res.ok) throw new Error('Failed to load data');
      const json = await res.json();
      setData(json);
      setKioskPaused(json.kioskPaused ?? false);
      setLastRefresh(new Date());
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    load();

    // Printer errors are pushed immediately; job rows use the three-second polling fallback.
    const supabase = createClient();
    const channel = supabase
      .channel('admin-print-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'printer_status' }, () => load())
      .subscribe();

    const iv = setInterval(load, 3_000);

    // Idle timer setup (A5)
    resetIdleTimer();
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'] as const;
    events.forEach(ev => document.addEventListener(ev, resetIdleTimer));

    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
      if (idleTimerRef.current)    clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
      events.forEach(ev => document.removeEventListener(ev, resetIdleTimer));
    };
  }, [load, resetIdleTimer]);

  const toggleKiosk = async () => {
    if (kioskToggling) return;
    setKioskToggling(true);
    try {
      const res = await fetch('/api/admin/kiosk-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !kioskPaused }),
      });
      if (!res.ok) throw new Error('Could not update kiosk state');
      setKioskPaused(p => !p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update kiosk state');
    } finally {
      setKioskToggling(false);
    }
  };

  const sendStatusToTelegram = async () => {
    if (tgSending) return;
    setTgSending(true);
    setTgToast(null);
    try {
      const res = await fetch('/api/admin/send-status', { method: 'POST' });
      const body = await res.json();
      if (res.ok) {
        setTgToast({ ok: true, msg: 'Status sent to Telegram ✓' });
      } else {
        setTgToast({ ok: false, msg: body.error ?? 'Failed to send' });
      }
    } catch {
      setTgToast({ ok: false, msg: 'Network error' });
    } finally {
      setTgSending(false);
      setTimeout(() => setTgToast(null), 4_000);
    }
  };

  const { jobs = [], printerStatus = null, paperInventory = null, stats } = data ?? {};
  const safeStats: Stats = stats ?? {
    totalRevenue: 0, todayRevenue: 0, totalJobs: 0,
    todayJobs: 0, totalPages: 0, failedJobs: 0, printingJobs: 0,
  };

  return (
    <div data-admin-dashboard style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: "'Inter', sans-serif",
      color: '#fff',
      overflow: 'hidden',
    }}>
      {/* Idle warning toast */}
      {idleWarning !== null && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#1F2937', border: '1px solid #F59E0B',
          borderRadius: 12, padding: '14px 20px',
          maxWidth: 340, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.875rem', marginBottom: 4 }}>
            ⚠️ Session expiring
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
            Session expires in {idleWarning} second{idleWarning === 1 ? '' : 's'} — move mouse to stay logged in
          </div>
        </div>
      )}

      {/* Telegram send toast */}
      {tgToast && (
        <div style={{
          position: 'fixed', bottom: idleWarning !== null ? 100 : 24, right: 24, zIndex: 9999,
          background: tgToast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${tgToast.ok ? '#4ADE80' : '#EF4444'}`,
          borderRadius: 12, padding: '12px 18px',
          color: tgToast.ok ? '#4ADE80' : '#FCA5A5',
          fontSize: '0.8rem', fontWeight: 600,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {tgToast.ok ? '✅' : '❌'} {tgToast.msg}
        </div>
      )}

      {/* Header */}
      <header style={{
        padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Admin Dashboard</span>
              {kioskPaused && (
                <span style={{
                  padding: '2px 10px', borderRadius: 6,
                  background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)',
                  color: '#EF4444', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                }}>PAUSED</span>
              )}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>
              Live updates · Last checked: {lastRefresh.toLocaleTimeString('en-IN')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Send status to Telegram */}
          <button
            onClick={sendStatusToTelegram}
            disabled={tgSending}
            title="Send current status to Telegram"
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: 'rgba(51,144,236,0.15)',
              color: '#60A5FA',
              cursor: tgSending ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
              opacity: tgSending ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            {tgSending ? 'Sending…' : 'Send to Telegram'}
          </button>
          {/* A15: Pause/Resume kiosk toggle */}
          <button
            onClick={toggleKiosk}
            disabled={kioskToggling}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: kioskPaused ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: kioskPaused ? '#4ADE80' : '#FBBF24',
              cursor: kioskToggling ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
              opacity: kioskToggling ? 0.6 : 1,
            }}
          >
            {kioskPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            onClick={onLogout}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
              fontSize: '0.8rem', transition: 'all 0.2s',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ padding: '16px 24px', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>

        {/* Printer Health Banner */}
        <div style={{ marginBottom: 24 }}>
          <PrinterBanner ps={printerStatus} />
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))',
          gap: 12, marginBottom: 20,
        }}>
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
            label="Total Revenue" value={fmt(safeStats.totalRevenue)}
            sub={`Today: ${fmt(safeStats.todayRevenue)}`} color="#4F46E5"
          />
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
            label="Total Jobs" value={safeStats.totalJobs.toString()}
            sub={`Today: ${safeStats.todayJobs}`} color="#10B981"
          />
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
            label="Pages Printed" value={safeStats.totalPages.toString()}
            color="#F59E0B"
          />
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><rect x="6" y="2" width="12" height="14" rx="2"/><path d="M6 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2"/><circle cx="12" cy="17" r="1"/></svg>}
            label="Printing Now" value={safeStats.printingJobs.toString()}
            color="#6366F1"
          />
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
            label="Failed Jobs" value={safeStats.failedJobs.toString()}
            color="#EF4444"
          />
        </div>

        <PaperInventoryCard inventory={paperInventory} onUpdated={load} />

        {/* Jobs Table */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Recent Print Jobs</h2>
            {loading && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>Refreshing…</span>}
          </div>

          {error ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#EF4444' }}>{error}</div>
          ) : jobs.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
              No print jobs yet. Jobs will appear here after uploads.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['File Name', 'Pages', 'Copies', 'Mode', 'Price', 'Payment', 'Print Status', 'Error', 'Created'].map(h => (
                      <th key={h} style={{
                        padding: '12px 16px', textAlign: 'left',
                        color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem',
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job, i) => (
                    <tr key={job.id} style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}>
                      <td style={{ padding: '14px 16px', maxWidth: 200 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#e2e8f0' }}>
                          {job.file_name}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 2, fontFamily: 'monospace' }}>
                          {job.id.slice(0, 8)}…
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#e2e8f0' }}>{job.page_count ?? '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#e2e8f0' }}>{job.copies}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.75rem', color: '#e2e8f0' }}>
                        {job.print_options?.colourMode === 'colour' ? '🎨 Colour' : '⬛ B&W'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#4ADE80' }}>
                        {job.total_price != null ? `₹${job.total_price}` : '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <JobBadge type="payment" val={job.payment_status} />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <JobBadge type="job" val={job.job_status} />
                        {job.job_status === 'PRINTING' && job.print_progress_known && (
                          <div style={{ marginTop: 5, fontSize: '0.65rem', color: '#A5B4FC' }}>
                            ~{job.estimated_sheets_printed} sheets estimated
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', maxWidth: 200 }}>
                        {job.error_message ? (
                          <span style={{
                            fontSize: '0.7rem', color: '#FCA5A5',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', display: 'block',
                          }} title={job.error_message}>
                            {job.error_message.slice(0, 60)}{job.error_message.length > 60 ? '…' : ''}
                          </span>
                        ) : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>
                        {fmtDate(job.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{
          marginTop: 24, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 16, padding: '20px 24px',
        }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FBBF24', marginBottom: 8 }}>
            Verification note
          </h2>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>
            Automated checks do not verify physical printing, payment-provider behavior, scheduled email delivery,
            or database backups. Test those against the deployed services and printer before relying on them.
          </div>
        </div>

      </main>
    </div>
  );
}

/* ─── Page Root ──────────────────────────────────────────── */
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin_authed') === '1') setAuthed(true);
  }, []);

  const handleSuccess = () => {
    sessionStorage.setItem('admin_authed', '1');
    setAuthed(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_authed');
    setAuthed(false);
    void fetch('/api/admin/logout', { method: 'POST' });
  };

  if (!authed) return <PinLogin onSuccess={handleSuccess} />;
  return <Dashboard onLogout={handleLogout} />;
}
