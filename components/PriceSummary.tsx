'use client';

import React from 'react';

interface PriceSummaryProps {
  perPagePrice: number;
  pageCount:    number;
  copies:       number;
  total:        number;
  currency?:    string;
}

function fmt(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(amount);
}

export default function PriceSummary({
  perPagePrice, pageCount, copies, total, currency = 'INR',
}: PriceSummaryProps) {
  const totalPages = pageCount * copies;

  return (
    <div className="price-card" aria-label="Price summary">
      <div className="price-card-title">Price Summary</div>

      <div className="price-row">
        <span>Price per page</span>
        <span data-testid="per-page-price">{fmt(perPagePrice, currency)}</span>
      </div>
      <div className="price-row">
        <span>Pages × Copies</span>
        <span>
          <span data-testid="page-count">{pageCount}</span>
          {' × '}
          <span data-testid="copies">{copies}</span>
          {' = '}
          {totalPages} pages
        </span>
      </div>

      <div className="price-total-row">
        <span className="price-total-label">Total</span>
        <span className="price-total-amount" aria-live="polite" data-testid="total">
          {fmt(total, currency)}
        </span>
      </div>
    </div>
  );
}
