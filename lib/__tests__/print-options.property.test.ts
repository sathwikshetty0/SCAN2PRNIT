// Feature: a4-print-kiosk, Property 6: Print options serialisation round-trip is lossless

import * as fc from 'fast-check';

/**
 * Validates: Requirements 3.6
 *
 * Property 6: Print options serialisation round-trip is lossless
 *
 * For any valid print_options object (orientation and colourMode values),
 * serialising it to JSON and deserialising it SHALL produce an object equal
 * to the original.
 */

interface PrintOptions {
  orientation: 'portrait' | 'landscape';
  colourMode: 'bw' | 'colour';
}

describe('Property 6: Print options serialisation round-trip is lossless', () => {
  it('JSON.stringify → JSON.parse produces an object deeply equal to the original', () => {
    const printOptionsArb = fc.record<PrintOptions>({
      orientation: fc.constantFrom('portrait' as const, 'landscape' as const),
      colourMode: fc.constantFrom('bw' as const, 'colour' as const),
    });

    fc.assert(
      fc.property(printOptionsArb, (options) => {
        const serialised = JSON.stringify(options);
        const deserialised = JSON.parse(serialised) as PrintOptions;

        expect(deserialised).toEqual(options);
        expect(deserialised.orientation).toBe(options.orientation);
        expect(deserialised.colourMode).toBe(options.colourMode);
      }),
      { numRuns: 100 }
    );
  });
});
