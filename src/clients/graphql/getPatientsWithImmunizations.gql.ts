export const GET_PATIENTS_WITH_IMMUNIZATIONS_QUERY = `
query GetPatientsWithImmunizations($limit: Int, $offset: Int) {
  patients(limit: $limit, offset: $offset) {
    id
    name
    client {
      id
      givenName
      familyName
      email
      primaryLocationId
    }
    immunizations {
      id
      name
      patient {
        id
        name
      }
      location {
        id
        name
      }
      provider {
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
      rabiesTagNumber
    }
  }
}
`;

