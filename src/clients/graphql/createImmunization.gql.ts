export const CREATE_IMMUNIZATION_MUTATION = `
mutation CreateImmunization($input: ImmunizationInput!) {
  createImmunization(input: $input) {
    id
    name
    patientId
    date
    dueDate
    administered
    declined
    historical
    immunizationStatus
    immunizationType
    route
    site
    lotNumber
    manufacturer
    expiryDate
    isRabies
    locationId
    providerId
  }
}
`;

