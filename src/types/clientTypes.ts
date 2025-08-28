export interface ClientImportRow {
  patientId: string | null;
  patientName: string | null;
  patientSpecies: string | null;
  patientBreed: string | null;
  patientSexSpay: string | null;
  clientId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  clientStreetAddr: string | null;
  patientWeight: string | null;
  patientColor: string | null;
  patientDOB: string | null;
  clientPostCode: string | null;
  clientCity: string | null;
  clientState: string | null;
  patientStatus: string | null;
}

export const EMPTY_CLIENT: ClientImportRow = {
  patientId: null,
  patientName: null,
  patientSpecies: null,
  patientBreed: null,
  patientSexSpay: null,
  clientId: null,
  clientFirstName: null,
  clientLastName: null,
  clientPhone: null,
  clientEmail: null,
  clientStreetAddr: null,
  patientWeight: null,
  patientColor: null,
  patientDOB: null,
  clientPostCode: null,
  clientCity: null,
  clientState: null,
  patientStatus: null
};

export function isClientImportRow(row: unknown): row is ClientImportRow {
  if (typeof row !== 'object' || row === null) return false;
  const r = row as Record<string, unknown>;
  const requiredFields = Object.keys(EMPTY_CLIENT);
  return requiredFields.every(field => field in r);
}