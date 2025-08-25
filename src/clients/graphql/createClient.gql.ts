export const CREATE_CLIENT_MUTATION = `
mutation CreateClient($input: ClientInput!) {
  createClient(input: $input) {
    id
    orgId
    name
    givenName
    familyName
    email
    secondaryEmail
    businessName
    dateOfBirth
    title
    notes
    privateNotes
    pronouns
    pronounsOther
    historicalId
    mergeIdentification
    identification
    billingId
    isActive
    isMerged
    taxExempt
    stopReminders
    declineEmail
    declinePhone
    declineRdvm
    declineSecondaryEmail
    insertedAt
    updatedAt
    verifiedAt
    emailVerifiedDate
    secondaryEmailVerifiedDate
    sentEmailVerificationDate
    sentSecondaryEmailVerificationDate
    lastSyncedAt
    accountCredit
    lifetimeValue
    trailingYearValue
    paymentCount
    primaryLocationId
    clientReferralSourceId
    customReferralSource
    stripeCustomerId
    cardconnectToken
    cardconnectTokenLast4
    cardconnectExpiry
    squareCardId
    addresses {
      id
      line1
      city
      state
      postalCode
    }
    phoneNumbers {
      id
      value
    }
    preferredPhoneNumber {
      id
      value
    }
  }
}
`;
