import { ClientImportRow } from "../types/clientTypes";
import { transformInputRow, TransformationMetadata } from "./transformer.js";
import { createClient, createPatient } from "../clients/apiClient.js";

export async function processOne(record: ClientImportRow, sendApiRequests: boolean = false, useRealLocation: boolean = false) {
    try {
        // Transform the record into API-compatible formats using unified function
        const { client: clientInput, patient: patientInput, metadata } = transformInputRow(record);

        // Create client first, then patient
        const clientResponse = await createClient(clientInput, sendApiRequests, useRealLocation);
        const patientResponse = await createPatient(clientResponse.createClient.id, patientInput, sendApiRequests, useRealLocation);

        const status = metadata.patientIsDeceased ? 'deceased' : 'active';
        const clientStatus = clientInput.isActive ? 'active' : 'inactive';
        
        console.log(`Created a ${patientInput.species} named ${patientInput.name} (${status}), owned by ${clientInput.givenName} ${clientInput.familyName} (${clientStatus})`);
        
        return {
            client: clientResponse.createClient,
            patient: patientResponse.createPatient,
            metadata
        };
    } catch (err) {
        // Log something like "Error processing [Virginia's] [Teacup] the [feline]"
        console.error(`Error processing ${record.clientFirstName}'s ${record.patientSpecies}, ${record.patientName}:\n\n`, err);
        throw err;
    }
}

export async function processAll(records: ClientImportRow[], sendApiRequests: boolean = false, useRealLocation: boolean = false) {
    const results = {
        successful: 0,
        failed: 0,
        deceasedPets: 0,
        inactiveClients: 0
    };

    for (const record of records) {
        try {
            const result = await processOne(record, sendApiRequests, useRealLocation);
            results.successful++;
            
            if (result.metadata.patientIsDeceased) {
                results.deceasedPets++;
                results.inactiveClients++; // Client is inactive when pet is deceased
            }
        } catch (err) {
            results.failed++;
        }
    }

    console.log('\nImport Summary:');
    console.log(`Successfully processed: ${results.successful}`);
    console.log(`Failed to process: ${results.failed}`);
    console.log(`Deceased pets: ${results.deceasedPets}`);
    console.log(`Inactive clients (due to deceased pets): ${results.inactiveClients}`);
    
    return results;
}