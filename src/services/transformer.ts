import { ClientImportRow, ClientInput, PatientInput, AddressInput, PhoneNumberInput } from '../types';

/**
 * Helper function to parse patientSexSpay field into sex and neutered status
 * Format: [M|F][I|S] where M=Male, F=Female, I=Intact, S=Spayed/Neutered
 * Examples: "MI" = Male Intact, "FS" = Female Spayed
 */
export function parseSexAndNeutered(patientSexSpay: string | null): { sex: string; neutered: boolean } {
  if (!patientSexSpay || patientSexSpay.length !== 2) {
    return { sex: 'Unknown', neutered: false };
  }

  const sexChar = patientSexSpay.charAt(0).toUpperCase();
  const neuteredChar = patientSexSpay.charAt(1).toUpperCase();

  const sex = sexChar === 'M' ? 'Male' : sexChar === 'F' ? 'Female' : 'Unknown';
  const neutered = neuteredChar === 'S'; // S = Spayed/Neutered, I = Intact

  return { sex, neutered };
}

/**
 * Helper function to determine if patient is deceased based on patientStatus
 * Returns true if status indicates deceased ("Deceased" or "N/A - D")
 * Note: This function is available for future use when patient status tracking is needed
 */
export function isPatientDeceased(patientStatus: string | null): boolean {
  if (!patientStatus) {
    return false;
  }
  
  const status = patientStatus.trim();
  return status === 'Deceased' || status === 'N/A - D';
}

/**
 * Transform ClientImportRow data into ClientInput format for the Vetspire API
 */
export function transformToClientInput(row: ClientImportRow): ClientInput {
  // Build address array if we have address data
  const addresses: AddressInput[] = [];
  if (row.clientStreetAddr && row.clientCity && row.clientState && row.clientPostCode) {
    addresses.push({
      line1: row.clientStreetAddr,
      city: row.clientCity,
      state: row.clientState,
      postalCode: row.clientPostCode
    });
  }

  // Build phone numbers array if we have phone data
  const phoneNumbers: PhoneNumberInput[] = [];
  if (row.clientPhone) {
    phoneNumbers.push({
      value: row.clientPhone
    });
  }

  return {
    givenName: row.clientFirstName || '',
    familyName: row.clientLastName || '',
    email: row.clientEmail || '',
    dateOfBirth: '', // Client DOB not available in import data
    addresses,
    phoneNumbers,
    notes: 'Imported from legacy system' // Mark as imported for tracking
  };
}

/**
 * Transform ClientImportRow data into PatientInput format for the Vetspire API
 */
export function transformToPatientInput(row: ClientImportRow): PatientInput {
  const { sex, neutered } = parseSexAndNeutered(row.patientSexSpay);

  return {
    name: row.patientName || '',
    species: row.patientSpecies || '',
    breed: row.patientBreed || '',
    color: row.patientColor || '',
    sex,
    neutered
  };
}
