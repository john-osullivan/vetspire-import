import { describe, it, expect } from 'vitest';
import { findExistingPatients } from '../src/clients/apiClient.js';

const requiredEnv = ['VETSPIRE_API_URL', 'VETSPIRE_API_KEY'];
function envIsConfigured() {
  return requiredEnv.every(k => typeof process.env[k] === 'string' && process.env[k]!.length > 0);
}

describe('getPatients query shape (live)', () => {
  it('returns patients with client givenName and familyName', async () => {
    if (!envIsConfigured()) {
      console.warn('Skipping live test: env not configured');
      return;
    }

    const res = await findExistingPatients(true, 100, 0);
    const patients = Array.isArray((res as { patients: unknown }).patients)
      ? (res as { patients: Array<any> }).patients
      : [];

    if (patients.length === 0) {
      throw new Error('No patients returned from API; cannot verify shape');
    }

    patients.every((patient) => {
      expect(typeof patient.id).toBe('string');
      expect(typeof patient.name).toBe('string');
      expect(patient.client && typeof patient.client.givenName).toBe('string');
      expect(patient.client && typeof patient.client.familyName).toBe('string');
      return true;
    })
  });
});

