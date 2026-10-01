'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import StepIndicator from '@/components/StepIndicator';
import StatusDisplay from '@/components/StatusDisplay';
import { PrintJob } from '@/types/print-job';
import { createClient } from '@/lib/supabase/client';

export default function StatusPage() {
  const params = useParams();
  const jobId = (params?.id as string) || '';

  const [job,     setJob]     = useState<PrintJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchJobStatus = async () => {
    try {
      const supabase = createClient();
      const { data, error: dbError } = await supabase
        .from('print_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (dbError || !data) throw new Error('Print job not found.');
      setJob(data as PrintJob);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error fetching status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobStatus();
    const interval = setInterval(fetchJobStatus, 10_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  return (
    <div>
      <StepIndicator currentStep={3} />

      <div className="card">
        <h1 className="page-title" style={{ textAlign: 'center', marginBottom: 4 }}>Print Status</h1>
        <p className="page-subtitle" style={{ textAlign: 'center', marginBottom: 24 }}>
          Auto-refreshes every 10 seconds
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <p className="loading-text">Checking job status…</p>
          </div>
        ) : error ? (
          <div className="alert-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        ) : job ? (
          <StatusDisplay job={job} />
        ) : null}
      </div>
    </div>
  );
}
