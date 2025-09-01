export const GET_PATIENTS_QUERY = `
query GetPatients($limit: Int, $offset: Int) {
  patients(limit: $limit, offset: $offset) {
    id
    name
    species
  historicalId
  privateNotes
  primaryLocationId
    client {
      id
      email
      primaryLocationId
    }
  }
}
`;
