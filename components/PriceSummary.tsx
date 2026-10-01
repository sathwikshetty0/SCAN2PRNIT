/**
 * PriceSummary — displays a breakdown of the print job cost.
 *
 * Shows per-page price, page count, number of copies, and total amount.
 * All monetary values are formatted to exactly two decimal places with a
 * currency symbol derived from the ISO 4217 currency code (e.g. "GBP" → "£").
 *
 * Layout is mobile-first (single column), scales up on wider viewports.
 *
 * @requirements 4.3 — display per-page price, page count, copies, and total
 * @requirements 4.4 — display all prices with two decimal places and currency symbol
 */

import React from 'react';

export interface PriceSummaryProps {
  /** Price per individual page in the chosen colour mode (e.g. 0.05). */
  perPagePrice: number;
  /** Number of pages in the uploaded document. */
  pageCount: number;
  /** Number of copies requested by the user (1–99). */
  copies: number;
  /** Pre-calculated total: perPagePrice × pageCount × copies. */
  total: number;
  /** ISO 4217 currency code, e.g. "GBP", "USD", "EUR". */
  currency: string;
}

/**
 * Format a number as a currency string with exactly two decimal places.
 *
 * Uses the browser's Intl.NumberFormat when available, falling back to a
 * simple toFixed(2) with a manually prepended symbol so the component
 * renders identically in test environments without full ICU data.
 *
 * Examples:
 *   formatCurrency(0.05, "GBP")  → "£0.05"
 *   formatCurrency(1.2, "USD")   → "$1.20"
 *   formatCurrency(0.5, "EUR")   → "€0.50"
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unknown currency codes or environments without ICU
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * PriceSummary component.
 *
 * Renders a visually distinct card containing four rows:
 *   - Price per page
 *   - Number of pages
 *   - Number of copies
 *   - Total (highlighted)
 *
 * @param perPagePrice - Cost per page in the chosen colour mode.
 * @param pageCount    - Number of pages in the PDF.
 * @param copies       - Number of copies selected.
 * @param total        - Total amount due.
 * @param currency     - ISO 4217 currency code.
 */
export default function PriceSummary({
  perPagePrice,
  pageCount,
  copies,
  total,
  currency,
}: PriceSummaryProps) {
  const formattedPerPage = formatCurrency(perPagePrice, currency);
  const formattedTotal = formatCurrency(total, currency);

  return (
    <section
      aria-label="Price summary"
      className="w-full rounded-2xl border border-indigo-100 bg-indigo-50 p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">
        Price Summary
      </h2>

      <dl className="space-y-2">
        {/* Per-page price */}
        <div className="flex items-center justify-between">
          <dt className="text-sm text-gray-600">Price per page</dt>
          <dd
            className="text-sm font-medium text-gray-900 tabular-nums"
            data-testid="per-page-price"
          >
            {formattedPerPage}
          </dd>
        </div>

        {/* Page count */}
        <div className="flex items-center justify-between">
          <dt className="text-sm text-gray-600">Pages</dt>
          <dd
            className="text-sm font-medium text-gray-900 tabular-nums"
            data-testid="page-count"
          >
            {pageCount}
          </dd>
        </div>

        {/* Copies */}
        <div className="flex items-center justify-between">
          <dt className="text-sm text-gray-600">Copies</dt>
          <dd
            className="text-sm font-medium text-gray-900 tabular-nums"
            data-testid="copies"
          >
            {copies}
          </dd>
        </div>

        {/* Divider */}
        <div className="border-t border-indigo-200" aria-hidden="true" />

        {/* Total */}
        <div className="flex items-center justify-between">
          <dt className="text-base font-semibold text-gray-900">Total</dt>
          <dd
            className="text-base font-bold text-indigo-700 tabular-nums"
            data-testid="total"
          >
            {formattedTotal}
          </dd>
        </div>
      </dl>
    </section>
  );
}
