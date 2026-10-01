'use client';

import React, { useEffect, useState, use } from 'react';
import StepIndicator from '@/components/StepIndicator';
import StatusDisplay from '@/components/StatusDisplay';
import { PrintJob } from '@/types/print-job';
import { createBrowserClient } from '@/lib/supabase/client';

export default function StatusPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const jobId = resolvedParams.id;

  const [job, setJob] = useState<PrintJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobStatus = async () => {
    try {
      const supabase = createBrowserClient();
      const { data, error: dbError } = await supabase
        .from('print_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (dbError || !data) {
        throw new Error('Print job not found.');
      }
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
    const interval = setInterval(fetchJobStatus, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator currentStep={4} />

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-gray-900 text-center">Print Job Status</h1>

        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Checking job status...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-600 text-sm font-medium">{error}</div>
        ) : job ? (
          <StatusDisplay job={job} />
        ) : null}
      </div>
    </div>
  );
}
