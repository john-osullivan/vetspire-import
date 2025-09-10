import fs from 'fs';
import pdfParse from 'pdf-parse';
import PDFParser from 'pdf2json';

export async function extractTextFromPdf(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  return pdfData.text;
}

// Minimal shape for pdf2json output we care about
export interface Pdf2JsonRun { T?: string }
export interface Pdf2JsonText { x: number; y: number; R?: Pdf2JsonRun[] }
export interface Pdf2JsonPage { Texts?: Pdf2JsonText[] }
export interface Pdf2JsonDoc { Pages?: Pdf2JsonPage[] }

// Attempt to load pdf2json at runtime so the project remains optional-dep free.
export async function extractPdf2Json(filePath: string): Promise<Pdf2JsonDoc | null> {
  try {
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
