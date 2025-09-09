export const GET_PATIENTS_QUERY = `
query GetPatients($limit: Int, $offset: Int) {
  patients(limit: $limit, offset: $offset) {
    age
    birthDate
    birthDay
    birthMonth
    birthYear
    breed
    client {
      id
      givenName
      familyName
      email
      primaryLocationId
    }
    color
    deceasedDate
    goalWeight
    historicalId
    id
    isActive
    isDeceased
    isEstimatedAge
    isEstimatedWeight
    lastSyncedAt
    microchip
    microchipRegistered
    name
    neuterDate
    neutered
    privateNotes
    profileImageUrl
    sex
    sexTerm
    species
    verifiedAt
  }
}
`;
