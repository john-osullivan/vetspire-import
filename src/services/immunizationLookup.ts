import { Patient } from '../types/apiTypes.js';

export function patientClientKey(patientName: string, familyName: string, givenName: string): string {
  return `${patientName.trim()}_(${familyName.trim()}, ${givenName.trim()})`.toLowerCase();
}

type PatientForLookup = Pick<Patient, 'id' | 'name'> & {
  client: { givenName?: string; familyName?: string };
};

export function buildPatientLookup(patients: PatientForLookup[]): Map<string, string> {
  return patients.reduce<Map<string, string>>((acc, p) => {
    const patientName = (p.name || '').trim();
    const given = (p.client?.givenName || '').trim();
    const family = (p.client?.familyName || '').trim();
    if (!patientName || !given || !family) {
      throw new Error(`Patient lookup requires client names. Offending patient id=${p.id}`);
    }
    const key = patientClientKey(patientName, family, given);
    if (!acc.has(key)) acc.set(key, p.id);
    return acc;
  }, new Map<string, string>());
}

