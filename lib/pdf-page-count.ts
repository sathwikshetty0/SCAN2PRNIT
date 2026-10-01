/**
 * Client-side PDF page count utility.
 *
 * @remarks
 * Requirement 4.5 — When the page count cannot be determined from the PDF,
 * the Web_App SHALL use the user-declared page count or default to 1.
 * This function is the primary mechanism for determining the page count;
 * it returns `null` on any error (including when `pdfjs-dist` fails to load
 * or fails to parse the PDF), so the caller can apply the appropriate fallback.
 *
 * `pdfjs-dist` is loaded via a dynamic import so that it is never bundled into
 * the initial page load — it is only fetched when the user selects a PDF file.
 */
export async function getPdfPageCount(file: File): Promise<number | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    const arrayBuffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return doc.numPages;
  } catch {
    return null;
  }
}
