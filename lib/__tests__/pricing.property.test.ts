import * as fc from 'fast-check';
import { calculatePrice } from '../pricing';

describe('Pricing logic properties', () => {
  it('Property 3: Price formula is exact linear multiplication', () => {
    // Feature: a4-print-kiosk, Property 3: Price formula is exact linear multiplication
    fc.assert(
      fc.property(
        fc.record({
          pageCount: fc.integer({ min: 1, max: 1000 }),
          copies: fc.integer({ min: 1, max: 99 }),
          price: fc.double({ min: 0.01, max: 1000, noNaN: true })
        }),
        ({ pageCount, copies, price }) => {
          const config = { bwPricePerPage: price, colourSurcharge: 0, currency: 'GBP' };
          const result = calculatePrice(config, pageCount, copies, 'bw');
          expect(result.total).toBeCloseTo(result.perPagePrice * pageCount * copies, 4);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Colour surcharge is always non-negative', () => {
    // Feature: a4-print-kiosk, Property 4: Colour surcharge is always non-negative
    fc.assert(
      fc.property(
        fc.record({
          bwPricePerPage: fc.double({ min: 0, max: 1000, noNaN: true }),
          colourSurcharge: fc.double({ min: 0, max: 1000, noNaN: true }),
          currency: fc.constant('GBP')
        }),
        (config) => {
          const bwResult = calculatePrice(config, 1, 1, 'bw');
          const colourResult = calculatePrice(config, 1, 1, 'colour');
          expect(colourResult.perPagePrice).toBeGreaterThanOrEqual(bwResult.perPagePrice);
        }
      ),
      { numRuns: 100 }
    );
  });
});
