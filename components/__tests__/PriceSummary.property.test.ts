/**
 * @jest-environment jsdom
 */

// Feature: a4-print-kiosk, Property 5: Price summary display always contains all required fields

import * as fc from 'fast-check';
import { render } from '@testing-library/react';
import React from 'react';
import PriceSummary from '../PriceSummary';

/**
 * Validates: Requirements 3.5, 4.3, 4.4
 *
 * Property 5: For any valid combination of copies, pageCount, and colourMode,
 * the PriceSummary component SHALL render per-page price, page count, copies,
 * and total — all formatted to exactly two decimal places.
 */
describe('PriceSummary — Property 5: all required fields present', () => {
  it('renders per-page price, page count, copies, and total for any valid input', () => {
    fc.assert(
      fc.property(
        fc.record({
          copies: fc.integer({ min: 1, max: 99 }),
          pageCount: fc.integer({ min: 1, max: 1000 }),
          colourMode: fc.constantFrom('bw' as const, 'colour' as const),
        }),
        ({ copies, pageCount, colourMode }) => {
          const perPagePrice = colourMode === 'bw' ? 0.05 : 0.15;
          const total = perPagePrice * pageCount * copies;

          const { container } = render(
            React.createElement(PriceSummary, {
              perPagePrice,
              pageCount,
              copies,
              total,
              currency: 'GBP',
            })
          );

          const text = container.textContent ?? '';

          // Per-page price, page count, copies, and total must all be present
          expect(container.querySelector('[data-testid="per-page-price"]')).not.toBeNull();
          expect(container.querySelector('[data-testid="page-count"]')).not.toBeNull();
          expect(container.querySelector('[data-testid="copies"]')).not.toBeNull();
          expect(container.querySelector('[data-testid="total"]')).not.toBeNull();

          // Per-page and total should contain digits formatted to 2 decimal places
          const perPageEl = container.querySelector('[data-testid="per-page-price"]')!;
          const totalEl = container.querySelector('[data-testid="total"]')!;
          expect(perPageEl.textContent).toMatch(/\d+\.\d{2}/);
          expect(totalEl.textContent).toMatch(/\d+\.\d{2}/);

          // page count and copies should be present as numbers
          expect(text).toContain(String(pageCount));
          expect(text).toContain(String(copies));
        }
      ),
      { numRuns: 100 }
    );
  });
});
