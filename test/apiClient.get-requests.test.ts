import { describe, it, expect, beforeAll } from 'vitest';
import * as apiClient from '../src/clients/apiClient.js';
import { Client, ClientInput, Patient, PatientInput } from '../src/types/apiTypes.js';
import { ClientImportRow } from '../src/types/clientTypes.js';
import { readCsvFile } from '../src/services/csvHandler.js';
import { transformInputRow } from '../src/services/transformer.js';

// These tests exercise the GET-esque functions in `src/clients/apiClient.ts`.
// They are intended to run against the real API when the environment is configured.
// If required environment variables are not present, the tests will be skipped.

const requiredEnv = ['VETSPIRE_API_URL', 'VETSPIRE_API_KEY'];

function envIsConfigured() {
    return requiredEnv.every(k => typeof process.env[k] === 'string' && process.env[k]!.length > 0);
}

describe('apiClient GET-style requests (live)', () => {
    beforeAll(() => {
        if (!envIsConfigured()) {
            console.warn('Skipping live apiClient tests because required env vars are not set.');
        }
    });

    it('findExistingClients returns a successful shape', async () => {
        if (!envIsConfigured()) return;

        const res = await apiClient.findExistingClients(true);
        expect(res).toBeDefined();
        expect(Array.isArray((res as any).clients)).toBe(true);

        const clients = (res as any).clients;
        if (clients.length > 0) {
            const c = clients[0];
            // Minimal shape checks
            expect(typeof c.id).toBe('string');
            expect('givenName' in c || 'familyName' in c || 'email' in c).toBe(true);
        }
    });

    it('findExistingPatients returns a successful shape', async () => {
        if (!envIsConfigured()) return;

        const res = await apiClient.findExistingPatients(true);
        expect(res).toBeDefined();
        expect(Array.isArray((res as any).patients)).toBe(true);

        const patients = (res as any).patients;
        if (patients.length > 0) {
            const p = patients[0];
            expect(typeof p.id).toBe('string');
            expect('name' in p || 'species' in p || 'client' in p).toBe(true);
        }
    });
});

describe('apiClient idempotency guarantee requests', () => {
    let existingPatients: Patient[] = [];
    let existingClients: Client[] = [];
    let inputs: { client: ClientInput, patient: PatientInput }[] = [];
    const CSV_PATH = "outputs/client-patient-records_2025-08-28T22-58-13-174Z.csv";

    beforeAll(async () => {
        if (!envIsConfigured()) throw new Error("Environment variables are not configured");

        const { patients, clients } = await apiClient.fetchAllExistingRecords(true);
        existingPatients = patients;
        existingClients = clients;
        const clientImportRows = await readCsvFile(CSV_PATH);
        clientImportRows.forEach((row) => {
            const { client, patient, metadata } = transformInputRow(row);
            inputs.push({ client, patient });
        });
    });

    it('findClientMatch detects existing client record', async () => {
        if (!envIsConfigured()) return;

        for (const row of inputs.slice(0, 10)) {
            const { client } = row;
            const result = apiClient.findClientMatch(client, existingClients)
            expect(result).toBeDefined();
        }
    });

    it('findPatientMatch detects existing patient record', async () => {
        if (!envIsConfigured()) return;

        for (const row of inputs.slice(0, 10)) {
            const { patient, client } = row;
            const result = apiClient.findPatientMatch(
                patient,
                client.historicalId as string,
                existingPatients
            )
            expect(result).toBeDefined();
        }
    });
})