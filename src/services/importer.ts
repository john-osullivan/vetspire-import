import { ClientImportRow } from "../types/clientTypes";
import { transformInputRow, TransformationMetadata } from "./transformer.js";
import { createClient, createPatient, fetchAllExistingRecords, updateClient } from "../clients/apiClient.js";
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
        successfulClients: 0,
        successfulPatients: 0,
        failedClients: 0,
        failedPatients: 0,
        skippedClients: 0,
        skippedPatients: 0,
        failedClientsList: [] as { name: string; email: string }[],
        failedPatientsList: [] as { pet: string; clientEmail: string }[]
    };

    let lastSuccessful = 0;
    let lastFailed = 0;
    let lastSkipped = 0;
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const { client: clientInput, patient: patientInput, metadata } = transformInputRow(record);
        let client = findExistingClient(clientInput);
        let clientId;
        if (!client) {
            try {
                const clientResponse = await createClient(clientInput, options);
                client = clientResponse.createClient;
                results.successfulClients++;
            } catch (err) {
                results.failedClients++;
                results.failedClientsList.push({
                    name: `${clientInput.givenName} ${clientInput.familyName}`,
                    email: clientInput.email || ''
                });
                console.error(`Error creating client for ${clientInput.givenName} ${clientInput.familyName}:`, err);
                // Progress log still counts this record, so no continue here
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
                results.successfulPatients++;
            } catch (err) {
                results.failedPatients++;
                results.failedPatientsList.push({
                    pet: `${patientInput.name} (${clientInput.email || ''})`,
                    clientEmail: clientInput.email || ''
                });
                console.error(`Error creating patient ${patientInput.name} for client ${clientInput.givenName} ${clientInput.familyName}:`, err);
                continue;
            }
        } else {
            results.skippedPatients++;
        }

        // Emit progress every 10 records
        if ((i + 1) % 10 === 0 || i === records.length - 1) {
            const totalSuccessful = results.successfulClients + results.successfulPatients;
            const totalFailed = results.failedClients + results.failedPatients;
            const totalSkipped = results.skippedClients + results.skippedPatients;
            console.log(`Progress: Processed ${i + 1} of ${records.length} records. ${totalSuccessful} (+${totalSuccessful - lastSuccessful}) successful, ${totalFailed} failed (+${totalFailed - lastFailed}), ${totalSkipped} skipped (+${totalSkipped - lastSkipped}).`);

            lastSuccessful = totalSuccessful;
            lastFailed = totalFailed;
            lastSkipped = totalSkipped;
        }
    }

    console.log('\nIdempotent Import Summary:');
    console.log(`Successfully created clients: ${results.successfulClients}`);
    console.log(`Successfully created patients: ${results.successfulPatients}`);
    console.log(`Failed to create clients: ${results.failedClients}`);
    console.log(`Failed to create patients: ${results.failedPatients}`);
    console.log(`Skipped existing clients: ${results.skippedClients}`);
    console.log(`Skipped existing patients: ${results.skippedPatients}`);
    if (results.failedClientsList.length > 0) {
        console.log('Failed to create clients:');
        results.failedClientsList.forEach(c => {
            console.log(`- ${c.name} (${c.email})`);
        });
    }
    if (results.failedPatientsList.length > 0) {
        console.log('Failed to create patients:');
        results.failedPatientsList.forEach(p => {
            console.log(`- ${p.pet}`);
        });
    }

    return results;
}

/**
 * Scan existing clients for those created by our importer and update their primaryLocationId
 */
export async function updateImportedPrimaryLocations(options: ImportOptions = {}) {
    const send = !!options.sendApiRequests;

    console.log('Scanning existing records to find imported clients...');
    const { clients } = await fetchAllExistingRecords(send);

    const importedClients = clients.filter((c: any) => {
        const notesMatch = c.notes && typeof c.notes === 'string' && c.notes.includes('Imported from legacy system');
        const hasHistorical = !!c.historicalId;
        return notesMatch || hasHistorical;
    });

    console.log(`Found ${importedClients.length} imported clients to examine`);

    let updated = 0;
    for (const client of importedClients) {
        const currentLocation = (client as any).primaryLocationId;

        const isPlaceholder = typeof currentLocation === 'string' && (currentLocation === 'TEST_LOCATION' || currentLocation.length < 10);
        if (!isPlaceholder) continue;

        const targetLocation = options.useRealLocation ? process.env.REAL_LOCATION_ID : process.env.TEST_LOCATION_ID;

        try {
            await updateClient(client.id, { primaryLocationId: targetLocation }, options);
            console.log(`Updated client ${client.id} primaryLocationId -> ${targetLocation}`);
            updated++;
        } catch (err) {
            console.error(`Failed to update client ${client.id}:`, err);
        }
    }

    console.log(`Update complete. Clients updated: ${updated}`);
    return { updated };
}
