import { describe, it, expect } from 'vitest';
import { 
  parseSexAndNeutered, 
  isPatientDeceased, 
  transformInputRow
} from '../services/transformer.js';
import { ClientImportRow } from '../types/clientTypes.js';

describe('parseSexAndNeutered', () => {
  it('should parse basic sex and neutered combinations', () => {
    expect(parseSexAndNeutered('MI')).toEqual({ sex: 'Male', neutered: false });
    expect(parseSexAndNeutered('FS')).toEqual({ sex: 'Female', neutered: true });
    expect(parseSexAndNeutered('MN')).toEqual({ sex: 'Male', neutered: true });
    expect(parseSexAndNeutered(null)).toEqual({ sex: 'Unknown', neutered: false });
  });
});

describe('isPatientDeceased', () => {
  it('should identify deceased patients correctly', () => {
    expect(isPatientDeceased('Deceased')).toBe(true);
    expect(isPatientDeceased('D')).toBe(true);
    expect(isPatientDeceased('N/A - D')).toBe(true);
    expect(isPatientDeceased('Home')).toBe(false);
    expect(isPatientDeceased(null)).toBe(false);
  });
});

describe('transformInputRow - Integration Tests', () => {
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

  it('should transform complete data correctly', () => {
    const { client, patient } = transformInputRow(mockRow);
    
    // Verify client transformation
    expect(client).toEqual({
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

    // Verify patient transformation
    expect(patient).toEqual({
      name: 'Buddy',
      species: 'Canine',
      breed: 'Golden Retriever',
      color: 'Golden',
      sex: 'Male',
      neutered: false
    });
  });

  it('should handle incomplete data gracefully', () => {
    const incompleteRow: ClientImportRow = {
      ...mockRow,
      clientPhone: null,
      clientStreetAddr: null,
      patientName: null,
      patientSexSpay: null
    };

    const { client, patient } = transformInputRow(incompleteRow);
    
    expect(client.phoneNumbers).toEqual([]);
    expect(client.addresses).toEqual([]);
    expect(patient.name).toBe('');
    expect(patient.sex).toBe('Unknown');
    expect(patient.neutered).toBe(false);
  });

  it('should handle female spayed with new neutering codes', () => {
    const femaleRow: ClientImportRow = {
      ...mockRow,
      patientSexSpay: 'FN' // Female Neutered
    };

    const { patient } = transformInputRow(femaleRow);
    
    expect(patient.sex).toBe('Female');
    expect(patient.neutered).toBe(true);
  });
});