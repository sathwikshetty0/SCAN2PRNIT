/**
 * Sanitises a raw filename for safe storage in Supabase Storage.
 *
 * Steps applied (in order):
 * 1. Strip a trailing `.pdf` extension (case-insensitive).
 * 2. Replace runs of whitespace with underscores.
 * 3. Remove any character that is not alphanumeric, a hyphen, or an underscore.
 * 4. Truncate the result to 100 characters.
 * 5. Fall back to `"document"` if the result is empty after sanitisation.
 * 6. Re-append the `.pdf` extension.
 *
 * @param raw - The original filename as provided by the user (e.g. `"My Document.pdf"`).
 * @returns A sanitised filename guaranteed to match `/^[a-zA-Z0-9_-]{1,100}\.pdf$/`.
 *
 * @requirement 2.6 — When a valid PDF file is uploaded, the Web_App SHALL sanitize the
 * filename by removing special characters and replacing spaces with underscores before storage.
 */
export function sanitizeFilename(raw: string): string {
  const withoutExtension = raw.replace(/\.pdf$/i, '');
  const sanitized = withoutExtension
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 100);
  return (sanitized || 'document') + '.pdf';
}
