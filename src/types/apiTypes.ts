// API input types - based on Vetspire GraphQL API documentation
// https://developer.vetspire.com/input_object/AddressInput
export interface AddressInput {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
}

// https://developer.vetspire.com/input_object/PhoneNumberInput
export interface PhoneNumberInput {
  value: string;
}

// https://developer.vetspire.com/input_object/ClientInput
export interface ClientInput {
  givenName: string;
  familyName: string;
  email: string;
  dateOfBirth: string;
  addresses: AddressInput[];
  phoneNumbers: PhoneNumberInput[];
  notes: string; // For marking test records
}

// https://developer.vetspire.com/input_object/PatientInput
export interface PatientInput {
  name: string;
  species: string;
  breed: string;
  color: string;
  sex: string;
  neutered: boolean;
}

// API response types - inferred from GraphQL mutations
export interface ClientResponse {
  createClient: {
    id: string;
    givenName: string;
    familyName: string;
  };
}

export interface PatientResponse {
  createPatient: {
    id: string;
    name: string;
    species: string;
  };
}