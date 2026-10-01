import { getPdfPageCount } from '../pdf-page-count';

// Mock pdfjs-dist
jest.mock('pdfjs-dist', () => {
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: jest.fn(),
    version: '2.14.305'
  };
}, { virtual: true });

describe('PDF page count logic', () => {
  it('returns page count when pdfjs succeeds', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as jest.Mock).mockReturnValue({
      promise: Promise.resolve({ numPages: 42 })
    });

    const file = new File(['mock content'], 'test.pdf', { type: 'application/pdf' });
    file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
    const count = await getPdfPageCount(file);
    expect(count).toBe(42);
  });

  it('returns null on pdfjs rejection', async () => {
    const pdfjsLib = await import('pdfjs-dist');
    (pdfjsLib.getDocument as jest.Mock).mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF'))
    });

    const file = new File(['mock content'], 'test.pdf', { type: 'application/pdf' });
    file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
    const count = await getPdfPageCount(file);
    expect(count).toBeNull();
  });
});
