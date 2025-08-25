import { config } from 'dotenv';
import { ClientInput, PatientInput, ClientResponse, PatientResponse } from '../types/apiTypes';
import { rateLimit } from '../services/rateLimiter';

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
  await rateLimit();
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
  await rateLimit();
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

// Helper methods for idempotent imports - check if records already exist

export async function findExistingClients(sendApiRequests: boolean = false, limit: number = 100, offset: number = 0) {
  await rateLimit();
  const query = `
    query GetClients($limit: Int, $offset: Int) {
      clients(limit: $limit, offset: $offset) {
        id
        givenName
        familyName
        email
        historicalId
        isActive
      }
    }`;

  if (!sendApiRequests) {
    console.log('DRY RUN - Would query existing clients');
    return { clients: [] }; // Return empty for dry run
  }

  return await graphqlRequest<{
    clients: Array<{
      id: string;
      givenName?: string;
      familyName?: string;
      email?: string;
      historicalId?: string;
      isActive?: boolean;
    }>
  }>(query, { limit, offset });
}

export async function findExistingPatients(sendApiRequests: boolean = false, limit: number = 100, offset: number = 0) {
  await rateLimit();
  const query = `
    query GetPatients($limit: Int, $offset: Int) {
      patients(limit: $limit, offset: $offset) {
        id
        name
        species
        historicalId
        isActive
        client {
          id
          givenName
          familyName
          email
        }
      }
    }`;

  if (!sendApiRequests) {
    console.log('DRY RUN - Would query existing patients');
    return { patients: [] }; // Return empty for dry run
  }

  return await graphqlRequest<{
    patients: Array<{
      id: string;
      name?: string;
      species?: string;
      historicalId?: string;
      isActive?: boolean;
      client?: {
        id: string;
        givenName?: string;
        familyName?: string;
        email?: string;
      };
    }>
  }>(query, { limit, offset });
}

// Check if client exists by email or name combination
export function findClientMatch(
  clientInput: { givenName?: string; familyName?: string; email?: string; historicalId?: string },
  existingClients: Array<{ id: string; givenName?: string; familyName?: string; email?: string; historicalId?: string }>
) {
  // First try historical ID match (most reliable)
  if (clientInput.historicalId) {
    const match = existingClients.find(c => c.historicalId === clientInput.historicalId);
    if (match) return { match, reason: 'historicalId' };
  }

  // Then try email match
  if (clientInput.email) {
    const match = existingClients.find(c => c.email && c.email.toLowerCase() === clientInput.email!.toLowerCase());
    if (match) return { match, reason: 'email' };
  }

  // Finally try name combination
  if (clientInput.givenName && clientInput.familyName) {
    const match = existingClients.find(c =>
      c.givenName && c.familyName &&
      c.givenName.toLowerCase() === clientInput.givenName!.toLowerCase() &&
      c.familyName.toLowerCase() === clientInput.familyName!.toLowerCase()
    );
    if (match) return { match, reason: 'name' };
  }

  return null;
}

// Check if patient exists by name + client combination
export function findPatientMatch(
  patientInput: { name?: string; species?: string; historicalId?: string },
  clientId: string,
  existingPatients: Array<{
    id: string;
    name?: string;
    species?: string;
    historicalId?: string;
    client?: { id: string };
  }>
) {
  // First try historical ID match
  if (patientInput.historicalId) {
    const match = existingPatients.find(p => p.historicalId === patientInput.historicalId);
    if (match) return { match, reason: 'historicalId' };
  }

  // Then try name + client combination (pet names should be unique per client)
  if (patientInput.name) {
    const match = existingPatients.find(p =>
      p.client?.id === clientId &&
      p.name && p.name.toLowerCase() === patientInput.name!.toLowerCase()
    );
    if (match) return { match, reason: 'name+client' };
  }

  return null;
}

// Generic autopagination helper
async function autopaginate<T>(
  fetchFunction: (limit: number, offset: number) => Promise<T[] | undefined>,
  itemName: string,
  limit: number = 100
): Promise<T[]> {
  const allItems: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const itemsRaw = await fetchFunction(limit, offset);
      const items: T[] = Array.isArray(itemsRaw) ? itemsRaw : [];

      allItems.push(...items);
      console.log(`Fetched ${items.length} ${itemName} (total: ${allItems.length})`);

      hasMore = items.length === limit;
      offset += limit;
    } catch (error) {
      console.error(`Error fetching ${itemName}:`, error);
      break;
    }
  }

  return allItems;
}

// Fetch all existing records with pagination
export async function fetchAllExistingRecords(sendApiRequests: boolean = false) {
  if (!sendApiRequests) {
    console.log('DRY RUN - Skipping fetch of existing records');
    return { clients: [], patients: [] };
  }

  console.log('Fetching existing records for idempotent import...');

  // Fetch all clients
  let allClients = await autopaginate(
    async (limit, offset) => {
      const response = await findExistingClients(sendApiRequests, limit, offset);
      return response && Array.isArray(response.clients) ? response.clients : [];
    },
    'clients'
  );
  if (!Array.isArray(allClients)) allClients = [];

  let allPatients = await autopaginate(
    async (limit, offset) => {
      const response = await findExistingPatients(sendApiRequests, limit, offset);
      return response && Array.isArray(response.patients) ? response.patients : [];
    },
    'patients'
  );
  if (!Array.isArray(allPatients)) allPatients = [];

  // Defensive logging
  console.log('DEBUG allClients:', allClients, 'type:', typeof allClients, 'isArray:', Array.isArray(allClients));
  console.log('DEBUG allPatients:', allPatients, 'type:', typeof allPatients, 'isArray:', Array.isArray(allPatients));

  if (!Array.isArray(allClients)) allClients = [];
  if (!Array.isArray(allPatients)) allPatients = [];

  console.log(`Found ${allClients.length} existing clients and ${allPatients.length} existing patients`);

  return { clients: allClients, patients: allPatients };
}