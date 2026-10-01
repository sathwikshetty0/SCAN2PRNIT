import * as fc from 'fast-check';
import { sanitizeFilename } from '../filename';

describe('Filename sanitisation properties', () => {
  it('Property 1: Filename sanitisation produces valid, bounded output', () => {
    // Feature: a4-print-kiosk, Property 1: Filename sanitisation produces valid, bounded output
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const sanitized = sanitizeFilename(raw);
        // Assert output matches /^[a-zA-Z0-9_-]{1,100}\.pdf$/
        expect(sanitized).toMatch(/^[a-zA-Z0-9_-]{1,100}\.pdf$/);
        // Assert base name <= 100 characters
        const baseName = sanitized.replace(/\.pdf$/, '');
        expect(baseName.length).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });
});
