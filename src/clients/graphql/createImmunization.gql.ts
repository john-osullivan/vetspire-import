export const CREATE_IMMUNIZATION_MUTATION = `
mutation CreateImmunization($input: ImmunizationInput!) {
  createImmunization(input: $input) {
    id
    name
    patient {
      id
      name
    }
    date
    dueDate
    administered
    declined
    historical
    immunizationStatus
    type
    route
    site
    lotNumber
    manufacturer
    expiryDate
    isRabies
    location {
      id
      name
    }
    provider {
      id
      name
    }
    rabiesTagNumber
  }
}
`;

