import { ClientImportRow } from './clientTypes.js';
import { Client, ClientInput, Patient, PatientInput } from './apiTypes.js';

// Centralized options for import process
export interface ImportOptions {
    sendApiRequests?: boolean;
    verbose?: boolean;
    trackResults?: boolean;
}

export interface ClientRecord {
    inputRecord: ClientInput;
    createdClient?: Client;
    updatedClient?: Client;
    oldClient?: Client
}

interface ClientInfo {
    givenName?: string;
    familyName?: string;
}

export interface PatientRecord {
    inputRecord: PatientInput & ClientInfo;
    createdPatient?: Patient;
    updatedPatient?: Patient;
    oldPatient?: Patient;
}

export interface ClientFailureRecord {
    inputRecord: ClientInput;
    error: string;
    timestamp: string;
}

export interface PatientFailureRecord {
    inputRecord: PatientInput & { email: string };
    error: string;
    timestamp: string;
}

export interface ImportResult {
    timestamp: string;
    totalRecords: number;
    clientsCreated: ClientRecord[];
    clientsSkipped: ClientRecord[];
    clientsFailed: ClientFailureRecord[];
    patientsCreated: PatientRecord[];
    patientsSkipped: PatientRecord[];
    patientsFailed: PatientFailureRecord[];
    clientsUpdated: ClientRecord[];
    patientsUpdated: PatientRecord[];
}

export function deepEqual(expected: Record<string, unknown>, found: Record<string, unknown>): boolean {
    if (expected === found) return true;
    if (
        typeof expected !== "object" ||
        typeof found !== "object" ||
        expected === null ||
        found === null) return false;

    const checkedKeys = Object.keys(expected);
    for (const key of checkedKeys) {
        // @ts-ignore
        if (!deepEqual(expected[key], found[key])) return false;
    }
    return true;
}
