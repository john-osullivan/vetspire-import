export const CREATE_PATIENT_MUTATION = `
mutation CreatePatient($clientId: ID!, $input: PatientInput!) {
  createPatient(clientId: $clientId, input: $input) {
    id
    name
    species
    breed
    color
    sex
    sexTerm
    birthDate
    birthYear
    birthMonth
    birthDay
    age
    isEstimatedAge
    clientId
    microchip
    microchipRegistered
    neutered
    neuterDate
    isDeceased
    deceasedDate
    goalWeight
    isEstimatedWeight
    profileImageUrl
    insertedAt
    updatedAt
    verifiedAt
    lastSyncedAt
    client {
      id
      givenName
      familyName
    }
  }
}
`;
