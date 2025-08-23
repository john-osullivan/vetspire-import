import { ClientPatientRecord, EMPTY_CLIENT } from '../types/clientTypes.js';

export function parseClientPatientRecords(pdfText: string): ClientPatientRecord[] {
  const records: ClientPatientRecord[] = [];
  const lines = pdfText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let currentRecord: ClientPatientRecord | null = null;
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
        (currentRecord as any)[key] = value;
        i += 2; // Skip both key and value lines
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