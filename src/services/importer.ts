import { ClientImportRow } from "../types/clientTypes";
import { transformInputRow, TransformationMetadata } from "./transformer.js";
import { createClient, createPatient } from "../clients/apiClient.js";
import { ImportOptions } from "../types/importOptions";

export async function processOne(record: ClientImportRow, options: ImportOptions) {
    // Transform the record into API-compatible formats using unified function
    const { client: clientInput, patient: patientInput, metadata } = transformInputRow(record);
    let clientResponse;
    try {
        // Create client first
        clientResponse = await createClient(clientInput, options);
    } catch (err) {
        console.error(`Error creating client for ${record.clientFirstName} ${record.clientLastName}:`, err);
        throw err;
    }

    let patientResponse;
    try {
        // Then create patient
        patientResponse = await createPatient(clientResponse.createClient.id, patientInput, options);
    } catch (err) {
        console.error(`Error creating patient ${record.patientName} (${record.patientSpecies}) for client ${record.clientFirstName} ${record.clientLastName}:`, err);
        throw err;
    }

    const status = metadata.patientIsDeceased ? 'deceased' : 'active';
    const clientStatus = clientInput.isActive ? 'active' : 'inactive';

    console.log(`Created a ${patientInput.species} named ${patientInput.name} (${status}), owned by ${clientInput.givenName} ${clientInput.familyName} (${clientStatus})`);

    return {
        client: clientResponse.createClient,
        patient: patientResponse.createPatient,
        metadata
    };
}

export async function processAll(records: ClientImportRow[], options: ImportOptions) {
    const results = {
        successful: 0,
        failed: 0,
        deceasedPets: 0,
        inactiveClients: 0
    };

    for (const record of records) {
        try {
            const result = await processOne(record, options);
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