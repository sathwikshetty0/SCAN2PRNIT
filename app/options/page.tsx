'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import StepIndicator from '@/components/StepIndicator';
import PrintOptionsForm, { PrintOptions } from '@/components/PrintOptionsForm';
import PriceSummary from '@/components/PriceSummary';
import { calculatePrice, getKioskConfig } from '@/lib/pricing';

function OptionsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const jobId = searchParams.get('job_id');
  const pageCountRaw = searchParams.get('page_count');
  const pageCount = pageCountRaw ? parseInt(pageCountRaw, 10) : 1;

  const [options, setOptions] = useState<PrintOptions>({
    copies: 1,
    orientation: 'portrait',
    colourMode: 'bw',
  });

  const [priceDetails, setPriceDetails] = useState({ perPagePrice: 0.05, total: 0.05 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = getKioskConfig();

  useEffect(() => {
    const { perPagePrice, total } = calculatePrice(
      config,
      pageCount,
      options.copies,
      options.colourMode
    );
    setPriceDetails({ perPagePrice, total });
  }, [options, pageCount]);

  if (!jobId) {
    return (
      <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
        <p className="text-red-600 font-medium">Invalid request. Missing job ID.</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
        >
          Return to Upload
        </button>
      </div>
    );
  }

  const handleProceedToPayment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          copies: options.copies,
          orientation: options.orientation,
          colourMode: options.colourMode,
          totalPrice: priceDetails.total,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err.message || 'Payment setup failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator currentStep={2} />

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-6">
        <h1 className="text-xl font-bold text-gray-900">Select Print Options</h1>

        <PrintOptionsForm
          onChange={(newOpts) => setOptions(newOpts)}
        />

        <PriceSummary
          perPagePrice={priceDetails.perPagePrice}
          pageCount={pageCount}
          copies={options.copies}
          total={priceDetails.total}
          currency={config.currency}
        />

        {error && (
          <p className="text-sm font-medium text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleProceedToPayment}
          disabled={loading}
          className={[
            'w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm',
            'min-h-[44px] hover:bg-indigo-500 active:bg-indigo-700 transition-colors',
            loading ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {loading ? 'Redirecting to payment...' : 'Proceed to Payment'}
        </button>
      </div>
    </div>
  );
}

export default function OptionsPage() {
  return (
    <Suspense fallback={<div className="text-center p-8 text-gray-500">Loading options...</div>}>
      <OptionsPageContent />
    </Suspense>
  );
}
