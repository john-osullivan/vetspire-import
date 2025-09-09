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

    const res = await findExistingPatients(true, 10, 0);
    const patients = Array.isArray((res as { patients: unknown }).patients)
      ? (res as { patients: Array<any> }).patients
      : [];

    if (patients.length === 0) return;

    const first = patients[0];
    expect(typeof first.id).toBe('string');
    expect(first.client && typeof first.client.givenName).toBe('string');
    expect(first.client && typeof first.client.familyName).toBe('string');
  });
});

