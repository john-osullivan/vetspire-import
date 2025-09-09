export const GET_CLIENTS_QUERY = `
query GetClients($limit: Int, $offset: Int) {
  clients(limit: $limit, offset: $offset) {
    id
    givenName
    familyName
    email
    primaryLocationId
    historicalId
    isActive
  }
}
`;
