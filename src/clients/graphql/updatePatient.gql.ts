export const UPDATE_PATIENT_MUTATION = `
mutation UpdatePatient($id: ID!, $input: PatientInput!) {
  updatePatient(id: $id, input: $input) {
    id
    name
    species
    isActive
  }
}
`;
