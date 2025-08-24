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

export async function createClient(input: ClientInput): Promise<ClientResponse> {
  const query = `
    mutation CreateClient($input: ClientInput!) {
      createClient(input: $input) {
        id
        givenName
        familyName
      }
    }`;
  
  return await graphqlRequest<ClientResponse>(query, { input });
}

export async function createPatient(clientId: string, input: PatientInput): Promise<PatientResponse> {
  const query = `
    mutation CreatePatient($clientId: ID!, $input: PatientInput!) {
      createPatient(clientId: $clientId, input: $input) {
        id
        name
        species
      }
    }`;
  
  return await graphqlRequest<PatientResponse>(query, { clientId, input });
}