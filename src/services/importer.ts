import { ClientImportRow } from "../types/clientTypes";
import { transformInputRow, TransformationMetadata } from "./transformer.js";
import { createClient, createPatient, fetchAllExistingRecords, findClientMatch, findPatientMatch, updateClient, updatePatient } from "../clients/apiClient.js";
import { Client, Patient } from '../types/apiTypes';
import { ImportOptions, ImportResult, ClientRecord, PatientRecord, ClientFailureRecord, PatientFailureRecord } from "../types/importOptions";
import { isClient, isPatient } from "./typeGuards.js";
import fs from 'fs';
import path from 'path';

/**
 * Idempotent import: fetch all existing clients and patients, and only create if not present.
 */
export async function processAll(records: ClientImportRow[], options: ImportOptions) {
    // Fetch all existing records from server
    const { clients: existingClients, patients: existingPatients } = await fetchAllExistingRecords(true);

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

    // Initialize detailed tracking if requested
    const detailedResult: ImportResult = {
        timestamp: new Date().toISOString(),
        totalRecords: records.length,
        clientsCreated: [],
        clientsSkipped: [],
        clientsFailed: [],
        patientsCreated: [],
        patientsSkipped: [],
        patientsFailed: []
    };

    let lastSuccessful = 0;
    let lastFailed = 0;
    let lastSkipped = 0;
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const { client: clientInput, patient: patientInput, metadata } = transformInputRow(record);
        let client = findClientMatch(clientInput, existingClients)?.match;
        let clientId;
        if (!client) {
            try {
                const clientResponse = await createClient(clientInput, options);
                client = clientResponse.createClient;
                if (!isClient(client)) {
                    throw new Error(`Created client missing required fields: ${JSON.stringify(client)}`);
                }
                detailedResult.clientsCreated.push({
                    inputRecord: record,
                    createdClient: client
                });
            } catch (err) {
                detailedResult.clientsFailed.push({
                    inputRecord: record,
                    error: err instanceof Error ? err.message : String(err),
                    timestamp: new Date().toISOString()
                });

                console.error(`Error creating client for ${clientInput.givenName} ${clientInput.familyName}:`, err);
                continue;
            }
        } else {
            clientId = client.id;

            // Validate existing client and track if requested
            if (!isClient(client)) {
                throw new Error(`Existing client missing required fields: ${JSON.stringify(client)}`);
            }
            detailedResult.clientsSkipped.push({
                inputRecord: record,
                createdClient: client
            });
        }
        clientId = clientId || client.id;

        let patient = findPatientMatch(patientInput, clientId, existingPatients)?.match;
        if (!patient) {
            try {
                const patientResponse = await createPatient(clientId, patientInput, options);
                patient = patientResponse.createPatient;

                // Validate patient response and track if requested
                if (!isPatient(patient)) {
                    throw new Error(`Created patient missing required fields: ${JSON.stringify(patient)}`);
                }
                detailedResult.patientsCreated.push({
                    inputRecord: record,
                    createdPatient: patient
                });
            } catch (err) {
                detailedResult.patientsFailed.push({
                    inputRecord: record,
                    error: err instanceof Error ? err.message : String(err),
                    timestamp: new Date().toISOString()
                });

                console.error(`Error creating patient ${patientInput.name} for client ${clientInput.givenName} ${clientInput.familyName}:`, err);
                continue;
            }
        } else {
            detailedResult.patientsSkipped.push({
                inputRecord: record,
                createdPatient: patient
            });
        }

        // Emit progress every 10 records
        if ((i + 1) % 10 === 0 || i === records.length - 1) {

            const totalSuccessful = detailedResult.clientsCreated.length + detailedResult.patientsCreated.length;
            const totalFailed = detailedResult.clientsFailed.length + detailedResult.patientsFailed.length;
            const totalSkipped = detailedResult.clientsSkipped.length + detailedResult.patientsSkipped.length;
            console.log(`Progress: Processed ${i + 1} of ${records.length} records. ${totalSuccessful} (+${totalSuccessful - lastSuccessful}) successful, ${totalFailed} failed (+${totalFailed - lastFailed}), ${totalSkipped} skipped (+${totalSkipped - lastSkipped}).`);

            lastSuccessful = totalSuccessful;
            lastFailed = totalFailed;
            lastSkipped = totalSkipped;
        }
    }

    console.log('\nIdempotent Import Summary:');
    console.log(`Successfully created clients: ${detailedResult.clientsCreated.length}`);
    console.log(`Successfully created patients: ${detailedResult.patientsCreated.length}`);
    console.log(`Failed to create clients: ${detailedResult.clientsFailed.length}`);
    console.log(`Failed to create patients: ${detailedResult.patientsFailed.length}`);
    console.log(`Skipped existing clients: ${detailedResult.clientsSkipped.length}`);
    console.log(`Skipped existing patients: ${detailedResult.patientsSkipped.length}`);
    if (detailedResult.clientsFailed.length > 0) {
        console.log('Failed to create clients:');
        detailedResult.clientsFailed.forEach(c => {
            const { clientFirstName, clientLastName, clientEmail } = c.inputRecord;
            console.log(`- ${clientFirstName} ${clientLastName} (${clientEmail})`);
        });
    }
    if (detailedResult.patientsFailed.length > 0) {
        console.log('Failed to create patients:');
        detailedResult.patientsFailed.forEach(p => {
            const { patientName, clientFirstName, clientLastName } = p.inputRecord;
            console.log(`- ${patientName} (${clientFirstName} ${clientLastName})`);
        });
    }

    // Generate JSON files if detailed tracking is enabled
    if (options.trackResults) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const runType = options.sendApiRequests ? 'full' : 'dry';
        const location = 'real';
        const outputDir = path.resolve(process.cwd(), 'outputs');

        // Ensure outputs directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write full results
        const resultsFile = path.join(outputDir, `import-results_${runType}_${location}_${timestamp}.json`);
        fs.writeFileSync(resultsFile, JSON.stringify(detailedResult, null, 2));
        console.log(`\nDetailed results written to: ${resultsFile}`);

        // Write failures-only file for easier analysis
        const failuresOnly = {
            timestamp: detailedResult.timestamp,
            totalRecords: detailedResult.totalRecords,
            clientsFailed: detailedResult.clientsFailed,
            patientsFailed: detailedResult.patientsFailed
        };

        const failuresFile = path.join(outputDir, `import-failures_${runType}_${location}_${timestamp}.json`);
        fs.writeFileSync(failuresFile, JSON.stringify(failuresOnly, null, 2));
        console.log(`Failures-only output written to: ${failuresFile}`);
    }

    return results;
}

/**
 * Scan existing clients for those created by our importer and update their primaryLocationId
 */
export async function updateImportedPrimaryLocations(options: ImportOptions = {}) {
    const send = !!options.sendApiRequests;

    console.log('Scanning existing records to find imported clients and patients...');
    const { clients, patients } = await fetchAllExistingRecords(send);

    // Narrow clients to typed Client[] and detect imported ones with safe runtime checks
    const typedClients = (clients as unknown) as Client[];
    const importedClients: Client[] = typedClients.filter(c => {
        const notes = typeof c.notes === 'string' ? c.notes : '';
        const hasHistorical = typeof c.historicalId === 'string' && c.historicalId.length > 0;
        return hasHistorical || notes.includes('Imported from legacy system');
    });

    // Narrow patients to typed Patient[] and detect imported ones with safe runtime checks
    const typedPatients = (patients as unknown) as Patient[];
    const importedPatients: Patient[] = typedPatients.filter(p => {
        const notes = (p as any).notes || (p as any).privateNotes || '';
        const hasHistorical = typeof p.historicalId === 'string' && p.historicalId.length > 0;
        return hasHistorical || (typeof notes === 'string' && notes.includes('Imported from legacy system'));
    });

    console.log(`Found ${importedClients.length} imported clients and ${importedPatients.length} imported patients to examine`);

    let updatedClients = 0;
    for (const client of importedClients) {
        const currentLocation = client.primaryLocationId;

        const isPlaceholder = typeof currentLocation === 'string' && (currentLocation === 'TEST_LOCATION' || currentLocation.length < 10);
        if (!isPlaceholder) continue;

        if (!process.env.REAL_LOCATION_ID) throw new Error('REAL_LOCATION_ID is required');
        const targetLocation = process.env.REAL_LOCATION_ID;

        try {
            await updateClient(client.id, { primaryLocationId: targetLocation }, options);
            console.log(`Updated client ${client.id} primaryLocationId -> ${targetLocation}`);
            updatedClients++;
        } catch (err) {
            console.error(`Failed to update client ${client.id}:`, err);
        }
    }

    let updatedPatients = 0;
    for (const patient of importedPatients) {
        // Patients may not have a primaryLocationId in our types, but the API may accept it via PatientInput
        const currentLocation = (patient as any).primaryLocationId;
        const isPlaceholder = typeof currentLocation === 'string' && (currentLocation === 'TEST_LOCATION' || currentLocation.length < 10);
        if (!isPlaceholder) continue;

        if (!process.env.REAL_LOCATION_ID) throw new Error('REAL_LOCATION_ID is required');
        const targetLocation = process.env.REAL_LOCATION_ID;

        try {
            await updatePatient(patient.id, { primaryLocationId: targetLocation }, options);
            console.log(`Updated patient ${patient.id} primaryLocationId -> ${targetLocation}`);
            updatedPatients++;
        } catch (err) {
            console.error(`Failed to update patient ${patient.id}:`, err);
        }
    }

    console.log(`Update complete. Clients updated: ${updatedClients}, Patients updated: ${updatedPatients}`);
    return { updatedClients, updatedPatients };
}
