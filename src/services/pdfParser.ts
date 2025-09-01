import fs from 'fs';
import { ClientImportRow, EMPTY_CLIENT } from '../types/clientTypes.js';
const IMPORT_KEYS = Object.keys(EMPTY_CLIENT);

export function parseClientPatientRecords(pdfText: string): ClientImportRow[] {
  const records: ClientImportRow[] = [];
  const lines = pdfText.split('\n').map(line => line.trim()).filter(line => line);

  // Some of these lines include erroneous values where 2 key
  // lines should've been split but weren't. For example, the line
  // `clientStreetAddrpatientWeight` needs to be converted into 
  // 2 lines, `clientStreetAddr` and `patientWeight`.
  lines.forEach((line, index) => {
    IMPORT_KEYS.forEach(key => {
      if (line.startsWith(key) && line.length > key.length) {
        const firstKey = line.slice(0, key.length);
        const secondKey = line.slice(key.length);
        lines[index] = firstKey;
        lines.splice(index + 1, 0, secondKey);
      }
    })
  });

  fs.writeFileSync('./outputs/parsed_lines.json', JSON.stringify(lines, null, 2));
  let currentRecord: ClientImportRow | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line is a key (next line should be the value)
    if (i + 1 < lines.length) {
      const key = line;
      const value = lines[i + 1];

      // If we encounter a patientId key, start a new record
      if (key === 'patientId') {
        // Save previous record if it exists and has required fields
        if (currentRecord && currentRecord.patientId && currentRecord.patientName) {
          records.push(currentRecord);
        }

        // Start new record
        currentRecord = { ...EMPTY_CLIENT };
        currentRecord.patientId = value;
        i += 2; // Skip both key and value lines
        continue;
      }

      // If we have a current record and this is a valid key, add the field
      if (currentRecord && Object.keys(EMPTY_CLIENT).includes(key)) {
        // assign via intermediate record to satisfy typing
        const rec = currentRecord as unknown as Record<string, unknown>;
        if (Object.keys(EMPTY_CLIENT).includes(value)) {
          // If the next non-blank line is a key, then the current key
          // has no value for this record. Add nothing, advance i by only 1
          // so that we might import the next row.
          rec[key] = null;
          i += 1;
        } else {
          rec[key] = typeof value === 'string' ? value : null;
          i += 2; // Skip both key and value lines
        }
        continue;
      }
    }

    // If we get here, skip this line (might be whitespace or unexpected content)
    i++;
  }

  // Don't forget to add the last record
  if (currentRecord && currentRecord.patientId && currentRecord.patientName) {
    records.push(currentRecord);
  }

  return records;
}