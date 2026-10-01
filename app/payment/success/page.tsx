'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import StepIndicator from '@/components/StepIndicator';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('job_id');

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator currentStep={3} />
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-2xl font-bold">
          ✓
        </div>
        <h1 className="text-xl font-bold text-gray-900">Payment Successful!</h1>
        <p className="text-sm text-gray-600">
          Your payment has been received. Your document is queued for printing.
        </p>
        <p className="text-xs text-gray-500">Estimated wait time: ~1–2 minutes</p>

        {jobId && (
          <button
            onClick={() => router.push(`/status/${jobId}`)}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors min-h-[44px]"
          >
            Track Print Status
          </button>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="text-center p-8 text-gray-500">Loading...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
