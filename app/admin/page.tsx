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

/* ─── PIN Gate ───────────────────────────────────────────── */
const ADMIN_PIN = '1234';

function PinLogin({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);
  const [locked, setLocked] = useState(false);

  const submit = () => {
    if (locked) return;
    if (pin === ADMIN_PIN) { onSuccess(); return; }
    const next = tries + 1;
    setTries(next);
    setPin('');
    if (next >= 5) {
      setLocked(true);
      setError('Too many attempts. Try again in 10 minutes.');
      setTimeout(() => { setLocked(false); setTries(0); setError(''); }, 600_000);
    } else {
      setError(`Incorrect PIN (${5 - next} attempt${5 - next === 1 ? '' : 's'} left)`);
    }
  };

  return (
    <div style={{
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
      borderRadius: 16, padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ color: '#fff', fontSize: '1.75rem', fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: 4 }}>{sub}</div>}
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
  const [data, setData]       = useState<{ jobs: PrintJob[]; printerStatus: PrinterStatus | null; stats: Stats; kioskPaused: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [kioskPaused, setKioskPaused] = useState(false);
  const [kioskToggling, setKioskToggling] = useState(false);

  // Idle auto-logout (A5) — 30 min idle timeout, 60s warning
  const idleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [idleWarning, setIdleWarning] = useState<number | null>(null); // countdown seconds

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current)    clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setIdleWarning(null);

    // 29 min: start warning countdown
    warningTimerRef.current = setTimeout(() => {
      let remaining = 60;
      setIdleWarning(remaining);
      const tick = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(tick);
          setIdleWarning(null);
        } else {
          setIdleWarning(remaining);
        }
      }, 1_000);
      // Keep reference so we can clear it
      (warningTimerRef.current as unknown as { _tick: ReturnType<typeof setInterval> })._tick = tick;
    }, 29 * 60 * 1_000);

    // 30 min: logout
    idleTimerRef.current = setTimeout(() => {
      onLogout();
    }, 30 * 60 * 1_000);
  }, [onLogout]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/jobs');
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
  }, []);

  useEffect(() => {
    load();

    // Supabase Realtime subscription (2a)
    const supabase = createClient();
    const channel = supabase
      .channel('admin-print-jobs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_jobs' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'print_jobs' }, () => load())
      .subscribe();

    const iv = setInterval(load, 10_000); // fallback polling

    // Idle timer setup (A5)
    resetIdleTimer();
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'] as const;
    events.forEach(ev => document.addEventListener(ev, resetIdleTimer));

    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
      if (idleTimerRef.current)    clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
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
      if (res.ok) {
        setKioskPaused(p => !p);
      }
    } catch { /* ignore */ } finally {
      setKioskToggling(false);
    }
  };

  const { jobs = [], printerStatus = null, stats } = data ?? {};
  const safeStats: Stats = stats ?? {
    totalRevenue: 0, todayRevenue: 0, totalJobs: 0,
    todayJobs: 0, totalPages: 0, failedJobs: 0, printingJobs: 0,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: "'Inter', sans-serif",
      color: '#fff',
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

      {/* Header */}
      <header style={{
        padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
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
              Auto-refreshes every 10s · Last: {lastRefresh.toLocaleTimeString('en-IN')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* A15: Pause/Resume kiosk toggle */}
          <button
            onClick={toggleKiosk}
            disabled={kioskToggling}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: kioskPaused
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(245,158,11,0.15)',
              color: kioskPaused ? '#4ADE80' : '#FBBF24',
              cursor: kioskToggling ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
              opacity: kioskToggling ? 0.6 : 1,
            }}
          >
            {kioskPaused ? '▶ Resume Kiosk' : '⏸ Pause Kiosk'}
          </button>
          <button
            onClick={onLogout}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
              fontSize: '0.8rem', transition: 'all 0.2s',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Printer Health Banner */}
        <div style={{ marginBottom: 24 }}>
          <PrinterBanner ps={printerStatus} />
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16, marginBottom: 32,
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

        {/* Test Case Status Summary */}
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>📋 Feature Status Report</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {[
              { label: 'User Flow (U1–U16)', done: 15, partial: 1, total: 16 },
              { label: 'File Upload Edge Cases (F1–F7)', done: 7, partial: 0, total: 7 },
              { label: 'Payment Edge Cases (P1–P7)', done: 7, partial: 0, total: 7 },
              { label: 'Print Resume & Recovery (R1–R13)', done: 13, partial: 0, total: 13 },
              { label: 'Printer Monitoring (PR1–PR6)', done: 6, partial: 0, total: 6 },
              { label: 'Admin Console (A1–A15)', done: 15, partial: 0, total: 15 },
              { label: 'Security (S1–S5)', done: 5, partial: 0, total: 5 },
              { label: 'Notifications (N1–N4)', done: 2, partial: 1, total: 4, note: 'N3 daily report pending' },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '16px 18px',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 10 }}>{s.label}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ flex: s.done, height: 6, borderRadius: 3, background: '#4ADE80' }} />
                  {s.partial > 0 && <div style={{ flex: s.partial, height: 6, borderRadius: 3, background: '#FBBF24' }} />}
                  <div style={{ flex: s.total - s.done - (s.partial ?? 0), height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }} />
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem' }}>
                  <span style={{ color: '#4ADE80' }}>✅ {s.done} done</span>
                  {s.partial > 0 && <span style={{ color: '#FBBF24' }}>⚠️ {s.partial} partial</span>}
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>{s.total} total</span>
                </div>
                {s.note && <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{s.note}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Known Gaps */}
        <div style={{
          marginTop: 24, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 16, padding: '20px 24px',
        }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#FCA5A5', marginBottom: 16 }}>
            🚨 Features NOT Yet Built (Will Get Stuck)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { id: 'N3', label: 'Daily Gmail summary report', risk: 'No passive overview of daily performance — needs cron scheduler' },
              { id: 'SR2', label: 'DB backup at midnight', risk: 'No disaster recovery for database corruption' },
              { id: 'U7', label: 'Actual duplex (double-sided) printing', risk: 'UI exists but actual duplex print depends on printer driver — HP LaserJet M1136 may not support duplex' },
              { id: 'U4', label: 'Specific page range selection', risk: 'UI exists but page range is not passed to print-controller PDF slicing yet' },
            ].map(g => (
              <div key={g.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 5, background: 'rgba(239,68,68,0.15)',
                  color: '#EF4444', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
                }}>{g.id}</span>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{g.label}</div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{g.risk}</div>
                </div>
              </div>
            ))}
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
  };

  if (!authed) return <PinLogin onSuccess={handleSuccess} />;
  return <Dashboard onLogout={handleLogout} />;
}
