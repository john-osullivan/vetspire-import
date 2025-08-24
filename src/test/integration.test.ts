import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import { parseClientPatientRecords } from '../services/pdfParser.js';
import { writeRecordsToCSV } from '../services/csvHandler.js';
import { extractTextFromPdf } from '../clients/pdfClient.js';

describe('PDF to CSV Integration', async () => {
  const testOutputDir = './outputs';
  const samplePdfText = await extractTextFromPdf('./advantage_labeled_export.pdf');



  it('should parse client-patient records from PDF text', () => {
    const records = parseClientPatientRecords(samplePdfText);

    expect(records).toBeDefined();
    expect(records.length).toBe(2415);
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
    const csvPath = writeRecordsToCSV(records, testOutputDir);

    expect(fs.existsSync(csvPath)).toBe(true);

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    expect(lines.length).toBe(3); // Header + 2 data rows
    expect(lines[0]).toContain('patientId,patientName');
  });

  it('should generate timestamped CSV filenames', () => {
    const records = parseClientPatientRecords(samplePdfText);
    const csvPath1 = writeRecordsToCSV(records.slice(0, 1), testOutputDir);
    const csvPath2 = writeRecordsToCSV(records.slice(0, 1), testOutputDir);

    expect(csvPath1).not.toBe(csvPath2);
    expect(csvPath1).toMatch(/client-patient-records_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });
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