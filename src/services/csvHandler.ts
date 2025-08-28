import fs, { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { ClientImportRow, EMPTY_CLIENT, isClientImportRow } from '../types/clientTypes.js';

export function writeRecordsToCSV(records: ClientImportRow[], outputDir: string): string {
  // Create timestamp for filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `client-patient-records_${timestamp}.csv`;
  const filePath = path.join(outputDir, filename);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get headers from interface keys
  const headers = Object.keys(EMPTY_CLIENT);

  // Create CSV content
  const csvLines = [headers.join(',')];

  for (const record of records) {
    const rec = record as unknown as Record<string, unknown>;
    const values = headers.map(key => {
      const value = rec[key];
      // Treat null/undefined as empty
      if (value === null || value === undefined) return '';
      const stringValue = typeof value === 'string' ? value : String(value);
      // Escape quotes and wrap in quotes if contains comma or quote
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvLines.push(values.join(','));
  }

  // Write to file
  fs.writeFileSync(filePath, csvLines.join('\n'));

  return filePath;
}


export function readCsvFile(inputDir: string): ClientImportRow[] {
  const csvContent = readFileSync(inputDir, 'utf-8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });

  const validRows: ClientImportRow[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (isClientImportRow(record)) {
      validRows.push(record);
    } else {
      throw new Error(`Invalid CSV row at index ${i}: ${JSON.stringify(record)}`);
    }
  }

  return validRows;
}