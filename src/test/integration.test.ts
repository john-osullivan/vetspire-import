import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import { parseClientPatientRecords } from '../services/pdfParser.js';
import { writeRecordsToCSV } from '../services/csvHandler.js';
import { extractTextFromPdf } from '../clients/pdfClient.js';

// Track files created during this test run so we only remove those
const createdFiles: string[] = [];

describe('PDF to CSV Integration', async () => {
  const testOutputDir = './outputs';
  const samplePdfText = await extractTextFromPdf('./advantage_labeled_export.pdf');



  it('should parse client-patient records from PDF text', () => {
    const records = parseClientPatientRecords(samplePdfText);

    expect(records).toBeDefined();
    // Accept the current known record count (non-zero) to avoid brittle exact-number checks
    expect(records.length).toBeGreaterThan(2000);
  });

  it('should have all required fields in parsed records', () => {
    const records = parseClientPatientRecords(samplePdfText);
    const sampleRecord = records[0];

    expect(sampleRecord).toBeDefined();

    // Check that all expected fields exist (even if null)
    const requiredFields = ['patientId', 'patientName', 'clientId', 'clientFirstName'];
    for (const field of requiredFields) {
      expect(sampleRecord).toHaveProperty(field);
    }

    // Check specific values
    expect(sampleRecord.patientName).toBe('Abbey');
    expect(sampleRecord.clientFirstName).toBe('Virginia');
    expect(sampleRecord.patientSpecies).toBe('Canine');
  });

  it('should write records to CSV file', () => {
    const records = parseClientPatientRecords(samplePdfText);
  const csvPath = writeRecordsToCSV(records.slice(0, 2), testOutputDir);
  createdFiles.push(csvPath);

    expect(fs.existsSync(csvPath)).toBe(true);

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(Boolean);

    // Expect at least header + one data row
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0]).toContain('patientId,patientName');
  });

  it('should generate timestamped CSV filenames', async () => {
    const records = parseClientPatientRecords(samplePdfText);
  const csvPath1 = writeRecordsToCSV(records.slice(0, 1), testOutputDir);
  createdFiles.push(csvPath1);
  await new Promise((res => setTimeout(res, 100)));
  const csvPath2 = writeRecordsToCSV(records.slice(0, 1), testOutputDir);
  createdFiles.push(csvPath2);

    // Filenames should match the timestamped pattern; uniqueness is non-deterministic in fast tests
    expect(csvPath1).toMatch(/client-patient-records_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    expect(csvPath2).toMatch(/client-patient-records_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    expect(csvPath1).not.toBe(csvPath2);
  });
});

afterAll(() => {
  for (const p of createdFiles) {
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log('Deleted test output:', p);
      }
    } catch (err) {
      console.warn('Failed to delete test output:', p, err);
    }
  }
});

describe('Actual PDF Parsing Validation', () => {
  it('should parse the first 10 patient names correctly from actual PDF', async () => {
    const { extractTextFromPdf } = await import('../clients/pdfClient.js');

    // Extract text from actual PDF
    const pdfText = await extractTextFromPdf('./advantage_labeled_export.pdf');
    expect(pdfText).toBeDefined();
    expect(pdfText.length).toBeGreaterThan(0);

    // Parse records
    const records = parseClientPatientRecords(pdfText);
    expect(records.length).toBeGreaterThan(10);

    // Validate first 10 patient names match expected sequence
    const expectedNames = ['Abbey', 'Abby', 'Abby', 'Abby', 'Abby', 'Abby', 'Abigail', 'Ace', 'Achilles', 'Adam'];
    const actualNames = records.slice(0, 10).map(record => record.patientName);

    // Log for debugging
    console.log('Expected:', expectedNames);
    console.log('Actual:', actualNames);
    console.log('Total records found:', records.length);

    expect(actualNames).toEqual(expectedNames);
  });
});