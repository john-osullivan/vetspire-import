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

export function isClientImportRow(row: any): row is ClientImportRow {
  const requiredFields = Object.keys(EMPTY_CLIENT);
  return (
    typeof row === 'object' &&
    row !== null &&
    requiredFields.every(field => field in row)
  );
}