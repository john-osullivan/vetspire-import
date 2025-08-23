import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import { extractTextFromPdf } from '../clients/pdfClient.js';
import { parseClientPatientRecords } from '../services/pdfParser.js';
import { writeRecordsToCSV } from '../services/csvWriter.js';

describe('PDF to CSV Integration', () => {
  const testPdfPath = './advantage_labeled_export.pdf';
  const testOutputDir = './test-outputs';
  let pdfText: string;
  
  beforeAll(async () => {
    // Extract PDF text once for all tests
    if (!fs.existsSync(testPdfPath)) {
      throw new Error(`Test PDF not found at ${testPdfPath}`);
    }
    pdfText = await extractTextFromPdf(testPdfPath);
  });
  
  afterAll(() => {
    // Clean up test outputs
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('should extract text from PDF', () => {
    expect(pdfText).toBeDefined();
    expect(pdfText.length).toBeGreaterThan(0);
  });

  it('should parse client-patient records from PDF text', () => {
    const records = parseClientPatientRecords(pdfText);
    
    expect(records).toBeDefined();
    expect(records.length).toBeGreaterThan(0);
  });

  it('should have all required fields in parsed records', () => {
    const records = parseClientPatientRecords(pdfText);
    const sampleRecord = records[0];
    
    expect(sampleRecord).toBeDefined();
    
    // Check that all expected fields exist (even if null)
    const requiredFields = ['patientId', 'patientName', 'clientId', 'clientFirstName'];
    for (const field of requiredFields) {
      expect(sampleRecord).toHaveProperty(field);
    }
  });

  it('should write records to CSV file', () => {
    const records = parseClientPatientRecords(pdfText);
    const csvPath = writeRecordsToCSV(records.slice(0, 5), testOutputDir);
    
    expect(fs.existsSync(csvPath)).toBe(true);
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    expect(lines.length).toBeGreaterThan(1); // Header + at least 1 data row
  });

  it('should generate timestamped CSV filenames', () => {
    const records = parseClientPatientRecords(pdfText);
    const csvPath1 = writeRecordsToCSV(records.slice(0, 1), testOutputDir);
    const csvPath2 = writeRecordsToCSV(records.slice(0, 1), testOutputDir);
    
    expect(csvPath1).not.toBe(csvPath2);
    expect(csvPath1).toMatch(/client-patient-records_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });
});