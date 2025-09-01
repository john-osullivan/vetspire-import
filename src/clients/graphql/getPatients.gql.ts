export const GET_PATIENTS_QUERY = `
query GetPatients($limit: Int, $offset: Int) {
  patients(limit: $limit, offset: $offset) {
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
    age
    isEstimatedAge
    microchip
    microchipRegistered
    neutered
    neuterDate
    isDeceased
    deceasedDate
    goalWeight
    isEstimatedWeight
    profileImageUrl
    historicalId
    privateNotes
    verifiedAt
    lastSyncedAt
    client {
      id
      email
      primaryLocationId
    }
  }
}
`;
