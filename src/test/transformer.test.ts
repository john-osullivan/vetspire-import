import { describe, it, expect } from 'vitest';
import { 
  parseSexAndNeutered, 
  isPatientDeceased, 
  transformToClientInput, 
  transformToPatientInput 
} from '../services/transformer.js';
import { ClientImportRow } from '../types/clientTypes.js';

describe('parseSexAndNeutered', () => {
  it('should parse male intact correctly', () => {
    const result = parseSexAndNeutered('MI');
    expect(result).toEqual({ sex: 'Male', neutered: false });
  });

  it('should parse female spayed correctly', () => {
    const result = parseSexAndNeutered('FS');
    expect(result).toEqual({ sex: 'Female', neutered: true });
  });

  it('should parse male spayed correctly', () => {
    const result = parseSexAndNeutered('MS');
    expect(result).toEqual({ sex: 'Male', neutered: true });
  });

  it('should parse female intact correctly', () => {
    const result = parseSexAndNeutered('FI');
    expect(result).toEqual({ sex: 'Female', neutered: false });
  });

  it('should handle lowercase input', () => {
    const result = parseSexAndNeutered('mi');
    expect(result).toEqual({ sex: 'Male', neutered: false });
  });

  it('should handle null input', () => {
    const result = parseSexAndNeutered(null);
    expect(result).toEqual({ sex: 'Unknown', neutered: false });
  });

  it('should handle invalid format', () => {
    const result = parseSexAndNeutered('XY');
    expect(result).toEqual({ sex: 'Unknown', neutered: false });
  });

  it('should handle wrong length input', () => {
    const result = parseSexAndNeutered('M');
    expect(result).toEqual({ sex: 'Unknown', neutered: false });
  });
});

describe('isPatientDeceased', () => {
  it('should return true for "Deceased" status', () => {
    expect(isPatientDeceased('Deceased')).toBe(true);
  });

  it('should return true for "N/A - D" status', () => {
    expect(isPatientDeceased('N/A - D')).toBe(true);
  });

  it('should return false for "Home" status', () => {
    expect(isPatientDeceased('Home')).toBe(false);
  });

  it('should return false for null status', () => {
    expect(isPatientDeceased(null)).toBe(false);
  });

  it('should handle whitespace in status', () => {
    expect(isPatientDeceased('  Deceased  ')).toBe(true);
    expect(isPatientDeceased('  N/A - D  ')).toBe(true);
  });

  it('should return false for other statuses', () => {
    expect(isPatientDeceased('Appointment')).toBe(false);
    expect(isPatientDeceased('Boarding')).toBe(false);
    expect(isPatientDeceased('ICU')).toBe(false);
  });
});

describe('transformToClientInput', () => {
  const mockRow: ClientImportRow = {
    patientId: '123',
    patientName: 'Buddy',
    patientSpecies: 'Canine',
    patientBreed: 'Golden Retriever',
    patientSexSpay: 'MI',
    clientId: '456',
    clientFirstName: 'John',
    clientLastName: 'Doe',
    clientPhone: '555-1234',
    clientEmail: 'john.doe@example.com',
    clientStreetAddr: '123 Main St',
    patientWeight: '65 lbs',
    patientColor: 'Golden',
    patientDOB: '2020-01-15',
    clientPostCode: '12345',
    clientCity: 'Anytown',
    clientState: 'CA',
    patientStatus: 'Home'
  };

  it('should transform complete client data correctly', () => {
    const result = transformToClientInput(mockRow);
    
    expect(result).toEqual({
      givenName: 'John',
      familyName: 'Doe',
      email: 'john.doe@example.com',
      dateOfBirth: '',
      addresses: [{
        line1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345'
      }],
      phoneNumbers: [{
        value: '555-1234'
      }],
      notes: 'Imported from legacy system'
    });
  });

  it('should handle missing optional fields', () => {
    const incompleteRow: ClientImportRow = {
      ...mockRow,
      clientPhone: null,
      clientStreetAddr: null,
      clientCity: null,
      clientState: null,
      clientPostCode: null
    };

    const result = transformToClientInput(incompleteRow);
    
    expect(result.addresses).toEqual([]);
    expect(result.phoneNumbers).toEqual([]);
    expect(result.givenName).toBe('John');
    expect(result.familyName).toBe('Doe');
  });

  it('should handle null client names', () => {
    const rowWithNullNames: ClientImportRow = {
      ...mockRow,
      clientFirstName: null,
      clientLastName: null,
      clientEmail: null
    };

    const result = transformToClientInput(rowWithNullNames);
    
    expect(result.givenName).toBe('');
    expect(result.familyName).toBe('');
    expect(result.email).toBe('');
  });
});

describe('transformToPatientInput', () => {
  const mockRow: ClientImportRow = {
    patientId: '123',
    patientName: 'Buddy',
    patientSpecies: 'Canine',
    patientBreed: 'Golden Retriever',
    patientSexSpay: 'MI',
    clientId: '456',
    clientFirstName: 'John',
    clientLastName: 'Doe',
    clientPhone: '555-1234',
    clientEmail: 'john.doe@example.com',
    clientStreetAddr: '123 Main St',
    patientWeight: '65 lbs',
    patientColor: 'Golden',
    patientDOB: '2020-01-15',
    clientPostCode: '12345',
    clientCity: 'Anytown',
    clientState: 'CA',
    patientStatus: 'Home'
  };

  it('should transform complete patient data correctly', () => {
    const result = transformToPatientInput(mockRow);
    
    expect(result).toEqual({
      name: 'Buddy',
      species: 'Canine',
      breed: 'Golden Retriever',
      color: 'Golden',
      sex: 'Male',
      neutered: false
    });
  });

  it('should handle female spayed patient', () => {
    const femaleSpayedRow: ClientImportRow = {
      ...mockRow,
      patientName: 'Bella',
      patientSexSpay: 'FS'
    };

    const result = transformToPatientInput(femaleSpayedRow);
    
    expect(result.name).toBe('Bella');
    expect(result.sex).toBe('Female');
    expect(result.neutered).toBe(true);
  });

  it('should handle missing patient fields', () => {
    const incompleteRow: ClientImportRow = {
      ...mockRow,
      patientName: null,
      patientSpecies: null,
      patientBreed: null,
      patientColor: null,
      patientSexSpay: null
    };

    const result = transformToPatientInput(incompleteRow);
    
    expect(result).toEqual({
      name: '',
      species: '',
      breed: '',
      color: '',
      sex: 'Unknown',
      neutered: false
    });
  });
});