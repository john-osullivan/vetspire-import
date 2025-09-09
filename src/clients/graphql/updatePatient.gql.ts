export const UPDATE_PATIENT_MUTATION = `
mutation UpdatePatient($id: ID!, $input: PatientInput!) {
  updatePatient(id: $id, input: $input) {
    id
    name
    species
    breed
    sex
    sexTerm
    birthDate
    birthYear
    birthMonth
    birthDay
    color
    age
    isEstimatedAge
    clientId
    microchip
    microchipRegistered
    neutered
    neuterDate
    isActive
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
