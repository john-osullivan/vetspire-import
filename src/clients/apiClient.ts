import { config } from 'dotenv';
import { ClientInput, PatientInput, ClientResponse, PatientResponse } from '../types/apiTypes';

config();

async function graphqlRequest<T>(query: string, variables?: any): Promise<T> {
  const params = new URLSearchParams();
  
  if (variables) {
    // Include variables in the GraphQL query
    params.append('query', query);
    params.append('variables', JSON.stringify(variables));
  } else {
    params.append('query', query);
  }
  
  const response = await fetch(process.env.VETSPIRE_API_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': process.env.VETSPIRE_API_KEY!
    },
    body: params
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
  }
  
  return result.data;
}

export async function createClient(input: ClientInput, sendApiRequests: boolean = false, useRealLocation: boolean = false): Promise<ClientResponse> {
  const query = `
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
    }`;
  
  // Set the primary location ID based on the mode
  const locationId = useRealLocation ? process.env.REAL_LOCATION_ID : process.env.TEST_LOCATION_ID;
  const inputWithLocation = { ...input, primaryLocationId: locationId };

  if (!sendApiRequests) {
    const locationDesc = useRealLocation ? 'REAL' : 'TEST';
    console.log(`DRY RUN - Would send createClient mutation with ${locationDesc} location (${locationId}):`, JSON.stringify(inputWithLocation, null, 2));
    return { createClient: { id: 'dry-run-client-id', givenName: input.givenName, familyName: input.familyName } };
  }
  
  return await graphqlRequest<ClientResponse>(query, { input: inputWithLocation });
}

export async function createPatient(clientId: string, input: PatientInput, sendApiRequests: boolean = false, useRealLocation: boolean = false): Promise<PatientResponse> {
  const query = `
    mutation CreatePatient($clientId: ID!, $input: PatientInput!) {
      createPatient(clientId: $clientId, input: $input) {
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
        clientId
        microchip
        microchipRegistered
        neutered
        neuterDate
        isDeceased
        deceasedDate
        goalWeight
        isEstimatedWeight
        profileImageUrl
        insertedAt
        updatedAt
        verifiedAt
        lastSyncedAt
        client {
          id
          givenName
          familyName
        }
      }
    }`;
  
  if (!sendApiRequests) {
    const locationDesc = useRealLocation ? 'REAL' : 'TEST';
    console.log(`DRY RUN - Would send createPatient mutation with clientId: ${clientId} and input:`, JSON.stringify(input, null, 2));
    return { createPatient: { id: 'dry-run-patient-id', name: input.name, species: input.species } };
  }
  
  return await graphqlRequest<PatientResponse>(query, { clientId, input });
}