import { config } from 'dotenv';
import { ClientInput, PatientInput, ClientResponse, PatientResponse, Patient } from '../types/apiTypes';
import { ImportOptions } from '../types/importOptions';
import { rateLimit } from '../services/rateLimiter';
import { CREATE_CLIENT_MUTATION } from './graphql/createClient.gql';
import { CREATE_PATIENT_MUTATION } from './graphql/createPatient.gql';
import { GET_CLIENTS_QUERY } from './graphql/getClients.gql';
import { GET_PATIENTS_QUERY } from './graphql/getPatients.gql';
import { UPDATE_CLIENT_MUTATION } from './graphql/updateClient.gql';
import { UPDATE_PATIENT_MUTATION } from './graphql/updatePatient.gql';

config();

async function graphqlRequest<T>(query: string, variables?: unknown): Promise<T> {
  const params = new URLSearchParams();

  if (variables && typeof variables === 'object') {
    // Include variables in the GraphQL query
    params.append('query', query);
    params.append('variables', JSON.stringify(variables));
  } else {
    params.append('query', query);
  }

  // Verbose logging support - __verbose may be present on variables object
  const verbose = typeof variables === 'object' && variables !== null && (variables as Record<string, unknown>).__verbose === true;
  if (verbose) {
    console.log('GraphQL Request:');
    // console.log('Query:', query);
    console.log('Variables:', JSON.stringify(variables, null, 2));
  }

  const response = await fetch(process.env.VETSPIRE_API_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json,application/graphql-response+json',
      'Authorization': process.env.VETSPIRE_API_KEY!
    },
    body: params
  });

  let responseText;
  try {
    responseText = await response.text();
  } catch (e) {
    responseText = '[Could not read response body]';
  }

  if (verbose) {
    console.log('GraphQL Response Body:', responseText);
  }

  if (!response.ok) {
    console.error(`GraphQL HTTP Error ${response.status}: ${response.statusText}`);
    console.error('Response body:', responseText);
    throw new Error(`HTTP ${response.status}: ${response.statusText} - Body: ${responseText}`);
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    console.error('Failed to parse response as JSON:', e);
    throw new Error('Failed to parse response as JSON');
  }
  if (result.errors) {
    console.error('GraphQL Error:', JSON.stringify(result.errors, null, 2));
    console.log();
    throw new Error(`GraphQL Error: ${JSON.stringify(result.errors, null, 2)}`);
  }

  return result.data;
}

export async function createClient(input: ClientInput, options: ImportOptions = {}): Promise<ClientResponse> {
  await rateLimit();
  const query = CREATE_CLIENT_MUTATION;
  // Always set primaryLocationId to the REAL_LOCATION_ID
  if (!process.env.REAL_LOCATION_ID) throw new Error('REAL_LOCATION_ID is required');
  const inputWithLocation = { ...input, primaryLocationId: process.env.REAL_LOCATION_ID };

  if (!options.sendApiRequests) {
    console.log(`DRY RUN - Would send createClient mutation with REAL location (${process.env.REAL_LOCATION_ID}):`, JSON.stringify(inputWithLocation, null, 2));
    return { createClient: { id: 'dry-run-client-id', givenName: input.givenName, familyName: input.familyName } };
  }

  return await graphqlRequest<ClientResponse>(query, { input: inputWithLocation, __verbose: options.verbose });
}

export async function createPatient(clientId: string, input: PatientInput, options: ImportOptions = {}): Promise<PatientResponse> {
  await rateLimit();
  const query = CREATE_PATIENT_MUTATION;

  if (!options.sendApiRequests) {
    console.log(`DRY RUN - Would send createPatient mutation for clientId: ${clientId} with REAL location (${process.env.REAL_LOCATION_ID}):`, JSON.stringify(input, null, 2));
    return { createPatient: { id: 'dry-run-patient-id', name: input.name, species: input.species } };
  }

  return await graphqlRequest<PatientResponse>(query, { clientId, input, __verbose: options.verbose });
}

// Helper methods for idempotent imports - check if records already exist

export async function findExistingClients(sendApiRequests: boolean = false, limit: number = 100, offset: number = 0) {
  await rateLimit();
  const query = GET_CLIENTS_QUERY;

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
  const query = GET_PATIENTS_QUERY;

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
        primaryLocationId?: string;
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

  let allPatients: Patient[] = await autopaginate(
    async (limit, offset) => {
      const response = await findExistingPatients(sendApiRequests, limit, offset);
      return response && Array.isArray(response.patients) ? response.patients : [];
    },
    'patients'
  );
  if (!Array.isArray(allPatients)) allPatients = [];

  if (!Array.isArray(allClients)) allClients = [];
  if (!Array.isArray(allPatients)) allPatients = [];

  console.log(`Found ${allClients.length} existing clients and ${allPatients.length} existing patients`);

  return { clients: allClients, patients: allPatients };
}

export async function updateClient(id: string, input: Partial<ClientInput>, options: ImportOptions = {}) {
  await rateLimit();
  const query = UPDATE_CLIENT_MUTATION;
  // Pass-through: caller decides what to update. Keep dry-run logging consistent with createPatient.
  if (!options.sendApiRequests) {
    console.log(`DRY RUN - Would send updateClient mutation for id ${id} with input:`, JSON.stringify(input, null, 2));
    return { updateClient: { id, ...input } };
  }

  return await graphqlRequest(query, { id, input, __verbose: options.verbose });
}

export async function updatePatient(id: string, input: Partial<PatientInput>, options: ImportOptions = {}) {
  await rateLimit();
  const query = UPDATE_PATIENT_MUTATION;

  if (!options.sendApiRequests) {
    console.log(`DRY RUN - Would send updatePatient mutation for id ${id} with input:`, JSON.stringify(input, null, 2));
    return { updatePatient: { id, ...input } };
  }

  return await graphqlRequest(query, { id, input, __verbose: options.verbose });
}