import { ClientPatientRecord, EMPTY_CLIENT } from '../types/clientTypes.js';

export function parseClientPatientRecords(pdfText: string): ClientPatientRecord[] {
  const records: ClientPatientRecord[] = [];
  
  // Split by double newlines to separate records
  const blocks = pdfText.split('\n\n').filter(block => block.trim().length > 0);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n').filter(line => line.trim().length > 0);
    
    // Initialize record with all fields as null
    const record: ClientPatientRecord = { ...EMPTY_CLIENT };
    
    // Parse each line as key-value pairs
    for (let i = 0; i < lines.length; i += 2) {
      const key = lines[i]?.trim();
      const value = lines[i + 1]?.trim();
      
      if (key && value !== undefined) {
        // Check if key exists in our interface
        if (Object.keys(EMPTY_CLIENT).includes(key)) {
          (record as any)[key] = value;
        }
      }
    }
    
    // Only add record if it has core identifying fields
    if (record.patientId && record.clientId && record.patientName && record.clientFirstName) {
      records.push(record);
    }
  }
  
  return records;
}