import fs from 'fs';

// Minimal shape for pdf2json output we care about
export interface Pdf2JsonRun { T?: string }
export interface Pdf2JsonText { x: number; y: number; R?: Pdf2JsonRun[] }
export interface Pdf2JsonPage { Texts?: Pdf2JsonText[] }
export interface Pdf2JsonDoc { Pages?: Pdf2JsonPage[] }

// Attempt to load pdf2json at runtime so the project remains optional-dep free.
export async function extractPdf2Json(filePath: string): Promise<Pdf2JsonDoc | null> {
  try {
    // Dynamically import to avoid hard dependency when not installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import('pdf2json');
    const PDFParser = (mod as any).default || (mod as any);
    const parser = new PDFParser();

    return await new Promise<Pdf2JsonDoc>((resolve, reject) => {
      parser.on('pdfParser_dataError', (err: any) => reject(err));
      parser.on('pdfParser_dataReady', (data: Pdf2JsonDoc) => resolve(data));
      parser.loadPDF(filePath);
    });
  } catch (err) {
    // Module not found or runtime error; caller can fallback
    return null;
  }
}

