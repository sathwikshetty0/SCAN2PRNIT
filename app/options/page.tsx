'use client';

import React, { useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import StepIndicator from '@/components/StepIndicator';
import PrintOptionsForm, { type PrintOptionsPriceResult } from '@/components/PrintOptionsForm';
import PriceSummary from '@/components/PriceSummary';
import { getKioskConfig } from '@/lib/pricing';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function OptionsPageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const jobId    = searchParams.get('job_id');
  const pageCount = parseInt(searchParams.get('page_count') || '1', 10);

  const config = getKioskConfig();

  // Latest result from PrintOptionsForm
  const [priceResult, setPriceResult] = useState<PrintOptionsPriceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handlePriceChange = useCallback((result: PrintOptionsPriceResult) => {
    setPriceResult(result);
  }, []);

  if (!jobId) {
    return (
      <div className="card text-center">
        <p style={{ color: 'var(--red-600)', fontWeight: 600, marginBottom: 16 }}>
          Invalid request — missing job ID.
        </p>
        <button className="btn-secondary" onClick={() => router.push('/')} style={{ width: 'auto', margin: '0 auto' }}>
          ← Return to Upload
        </button>
      </div>
    );
  }

  const handleProceedToPayment = async () => {
    if (!priceResult) return;
    setLoading(true);
    setError(null);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay. Please check your internet connection.');

      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          copies:     priceResult.copies,
          orientation: priceResult.options.orientation,
          colourMode:  priceResult.options.colourMode,
          totalPrice:  priceResult.total,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || 'Failed to create payment order');
      }

      const { orderId, amount, currency, keyId } = await res.json();

      const rzpOptions = {
        key: keyId,
        amount,
        currency,
        name:        'PrintKiosk',
        description: 'A4 Document Printing',
        order_id:    orderId,
        handler: async (resp: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const vRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id:   resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature:  resp.razorpay_signature,
              jobId,
            }),
          });
          router.push(vRes.ok ? `/payment/success?job_id=${jobId}` : `/payment/cancel?job_id=${jobId}`);
        },
        prefill: {},
        theme: { color: '#4F46E5' },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError('Payment was cancelled. You can try again.');
          },
        },
      };

      const rzp = new (window as any).Razorpay(rzpOptions);
      rzp.open();
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Payment setup failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      <StepIndicator currentStep={2} />

      <div className="card">
        <h1 className="page-title">Print Options</h1>
        <p className="page-subtitle">Configure your print job below.</p>

        <PrintOptionsForm
          pageCount={pageCount}
          onPriceChange={handlePriceChange}
        />

        <div style={{ marginTop: 24 }}>
          <PriceSummary
            perPagePrice={priceResult?.perPagePrice ?? 0}
            pageCount={pageCount}
            copies={priceResult?.copies ?? 1}
            total={priceResult?.total ?? 0}
            currency={config.currency}
          />
        </div>

        {error && (
          <div className="alert-error" style={{ marginTop: 16 }} role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button
            id="proceed-to-payment-btn"
            className="btn-primary"
            onClick={handleProceedToPayment}
            disabled={loading || !priceResult}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, margin: 0 }} />
                Opening payment…
              </>
            ) : (
              <>
                Pay {priceResult ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: config.currency }).format(priceResult.total) : ''}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>

          <div className="trust-line">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 1L1.5 3v3c0 2.5 1.9 4.8 4.5 5.5C8.6 10.8 10.5 8.5 10.5 6V3L6 1z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
            </svg>
            Secured by Razorpay · 256-bit SSL
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OptionsPage() {
  return (
    <Suspense fallback={
      <div className="card text-center" style={{ padding: 48 }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <p className="loading-text">Loading options…</p>
      </div>
    }>
      <OptionsPageContent />
    </Suspense>
  );
}
