'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function PaymentCancelContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('job_id');

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center gap-4 text-center mt-12">
      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-2xl font-bold">
        !
      </div>
      <h1 className="text-xl font-bold text-gray-900">Payment Cancelled</h1>
      <p className="text-sm text-gray-600">
        You cancelled the payment. No charges were made.
      </p>

      {jobId ? (
        <button
          onClick={() => router.push(`/options?job_id=${jobId}`)}
          className="mt-4 w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors min-h-[44px]"
        >
          Return to Print Options
        </button>
      ) : (
        <button
          onClick={() => router.push('/')}
          className="mt-4 w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors min-h-[44px]"
        >
          Start Over
        </button>
      )}
    </div>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="text-center p-8 text-gray-500">Loading...</div>}>
      <PaymentCancelContent />
    </Suspense>
  );
}
