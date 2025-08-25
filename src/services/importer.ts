import { ClientImportRow } from "../types/clientTypes";
import { transformInputRow, TransformationMetadata } from "./transformer.js";
import { createClient, createPatient, fetchAllExistingRecords } from "../clients/apiClient.js";
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

/**
 * Idempotent import: fetch all existing clients and patients, and only create if not present.
 */
export async function processAll(records: ClientImportRow[], options: ImportOptions) {
    // Fetch all existing records from server
    const { clients: existingClients, patients: existingPatients } = await fetchAllExistingRecords(true);

    // Helper to find existing client by unique fields (customize as needed)
    function findExistingClient(clientInput: any) {
        return existingClients.find((c: any) =>
            c.givenName?.toLowerCase() === clientInput.givenName?.toLowerCase() &&
            c.familyName?.toLowerCase() === clientInput.familyName?.toLowerCase() &&
            c.email?.toLowerCase() === clientInput.email?.toLowerCase()
        );
    }

    // Helper to find existing patient by unique fields (customize as needed)
    function findExistingPatient(patientInput: any, clientId: string) {
        return existingPatients.find((p: any) =>
            p.name?.toLowerCase() === patientInput.name?.toLowerCase() &&
            p.client?.id === clientId
        );
    }

    const results = {
        successful: 0,
        failed: 0,
        skippedClients: 0,
        skippedPatients: 0,
        failedClients: [] as { name: string; email: string }[],
        failedPatients: [] as { pet: string; clientEmail: string }[]
    };

    for (const record of records) {
        const { client: clientInput, patient: patientInput, metadata } = transformInputRow(record);
        let client = findExistingClient(clientInput);
        let clientId;
        if (!client) {
            try {
                const clientResponse = await createClient(clientInput, options);
                client = clientResponse.createClient;
                results.successful++;
            } catch (err) {
                results.failed++;
                results.failedClients.push({
                    name: `${clientInput.givenName} ${clientInput.familyName}`,
                    email: clientInput.email || ''
                });
                console.error(`Error creating client for ${clientInput.givenName} ${clientInput.familyName}:`, err);
                continue;
            }
        } else {
            results.skippedClients++;
            clientId = client.id;
        }
        clientId = clientId || client.id;

        let patient = findExistingPatient(patientInput, clientId);
        if (!patient) {
            try {
                const patientResponse = await createPatient(clientId, patientInput, options);
                patient = patientResponse.createPatient;
                results.successful++;
            } catch (err) {
                results.failed++;
                results.failedPatients.push({
                    pet: `${patientInput.name} (${clientInput.email || ''})`,
                    clientEmail: clientInput.email || ''
                });
                console.error(`Error creating patient ${patientInput.name} for client ${clientInput.givenName} ${clientInput.familyName}:`, err);
                continue;
            }
        } else {
            results.skippedPatients++;
        }
    }

    console.log('\nIdempotent Import Summary:');
    console.log(`Successfully created: ${results.successful}`);
    console.log(`Failed to create: ${results.failed}`);
    console.log(`Skipped existing clients: ${results.skippedClients}`);
    console.log(`Skipped existing patients: ${results.skippedPatients}`);
    if (results.failedClients.length > 0) {
        console.log('Failed to create clients:');
        results.failedClients.forEach(c => {
            console.log(`- ${c.name} (${c.email})`);
        });
    }
    if (results.failedPatients.length > 0) {
        console.log('Failed to create patients:');
        results.failedPatients.forEach(p => {
            console.log(`- ${p.pet}`);
        });
    }

    return results;
}
