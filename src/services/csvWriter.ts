import fs from 'fs';
import path from 'path';
import { ClientPatientRecord, EMPTY_CLIENT } from '../types/clientTypes.js';

export function writeRecordsToCSV(records: ClientPatientRecord[], outputDir: string): string {
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
    const values = headers.map(key => {
      const value = (record as any)[key];
      // Handle null values and escape commas/quotes
      if (value === null) return '';
      const stringValue = String(value);
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