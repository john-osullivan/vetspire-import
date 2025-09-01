import { ClientImportRow } from './clientTypes.js';
import { Client, Patient } from './apiTypes.js';

// Centralized options for import process
export interface ImportOptions {
    sendApiRequests?: boolean;
    useRealLocation?: boolean;
    verbose?: boolean;
    trackResults?: boolean;
}

export interface ClientRecord {
    inputRecord: ClientImportRow;
    createdClient?: Client;
}

export interface PatientRecord {
    inputRecord: ClientImportRow;
    createdPatient?: Patient;
}

export interface ClientFailureRecord {
    inputRecord: ClientImportRow;
    error: string;
    timestamp: string;
}

export interface PatientFailureRecord {
    inputRecord: ClientImportRow;
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
}
