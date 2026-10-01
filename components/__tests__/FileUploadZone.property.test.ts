// Feature: a4-print-kiosk, Property 2: File validation rejects invalid type or size

import * as fc from 'fast-check';
import {
  validateFile,
  MAX_FILE_SIZE_BYTES,
  ACCEPTED_MIME_TYPE,
} from '../FileUploadZone';

/**
 * Property 2: File validation rejects invalid type or size
 *
 * For any file-like input, the client-side validator SHALL accept the file if
 * and only if its MIME type is `application/pdf` AND its size in bytes is less
 * than or equal to 20,971,520 (20 MB).  Any file failing either condition SHALL
 * be rejected.
 *
 * Validates: Requirements 2.2, 2.3
 */
describe('Property 2: File validation rejects invalid type or size', () => {
  it('accepts if and only if mimeType === "application/pdf" && size <= 20_971_520', () => {
    fc.assert(
      fc.property(
        fc.record({
          mimeType: fc.string(),
          size: fc.nat(),
        }),
        ({ mimeType, size }) => {
          const result = validateFile(mimeType, size);

          const shouldBeValid =
            mimeType === ACCEPTED_MIME_TYPE && size <= MAX_FILE_SIZE_BYTES;

          return result.valid === shouldBeValid;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns a non-null error message for every rejected file', () => {
    fc.assert(
      fc.property(
        fc.record({
          mimeType: fc.string(),
          size: fc.nat(),
        }),
        ({ mimeType, size }) => {
          const result = validateFile(mimeType, size);

          const shouldBeValid =
            mimeType === ACCEPTED_MIME_TYPE && size <= MAX_FILE_SIZE_BYTES;

          if (!shouldBeValid) {
            // Every rejection must carry a non-empty error string
            return (
              result.valid === false &&
              typeof result.error === 'string' &&
              result.error.length > 0
            );
          }

          // Accepted files must have no error
          return result.valid === true && result.error === null;
        },
      ),
      { numRuns: 100 },
    );
  });
});
