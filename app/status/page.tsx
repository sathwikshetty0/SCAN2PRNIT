'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function StatusRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const jobId = searchParams.get('job_id');
    if (jobId) {
      router.replace(`/status/${jobId}`);
    } else {
      router.replace('/');
    }
  }, [searchParams, router]);

  return (
    <div className="card text-center" style={{ padding: 48 }}>
      <div className="spinner" style={{ margin: '0 auto' }} />
    </div>
  );
}

export default function StatusIndexPage() {
  return (
    <Suspense fallback={<div className="card text-center" style={{ padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}>
      <StatusRedirect />
    </Suspense>
  );
}
