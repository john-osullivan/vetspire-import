export const UPDATE_CLIENT_MUTATION = `
mutation UpdateClient($id: ID!, $input: ClientInput!) {
  updateClient(id: $id, input: $input) {
    id
    primaryLocationId
    givenName
    familyName
    email
  }
}
`;
