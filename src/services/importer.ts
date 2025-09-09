import { ClientImportRow } from "../types/clientTypes";
import { transformInputRow, TransformationMetadata } from "./transformer.js";
import { createClient, createPatient, fetchAllExistingRecords, findClientMatch, findPatientMatch, updateClient, updatePatient } from "../clients/apiClient.js";
import { Client, ClientInput, Patient } from '../types/apiTypes';
import { ImportOptions, ImportResult, deepEqual } from "../types/importOptions.js";
import { isClient, isPatient } from "./typeGuards.js";
import fs from 'fs';
import path from 'path';

/**
 * Idempotent import: fetch all existing clients and patients, and only create if not present.
 */
export async function processAll(records: ClientImportRow[], options: ImportOptions) {
    // Fetch all existing records from server
    const { clients: existingClients, patients: existingPatients } = await fetchAllExistingRecords(true);

    // Initialize detailed tracking if requested
    const detailedResult: ImportResult = {
        timestamp: new Date().toISOString(),
        totalRecords: records.length,
        clientsCreated: [],
        clientsSkipped: [],
        clientsFailed: [],
        patientsCreated: [],
        patientsSkipped: [],
        patientsFailed: [],
        clientsUpdated: [],
        patientsUpdated: [],
    };

    let lastSuccessful = 0;
    let lastFailed = 0;
    let lastSkipped = 0;
    let lastUpdated = 0;
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const { client: clientInput, patient: patientInput, metadata } = transformInputRow(record);
        let client = findClientMatch(clientInput, existingClients)?.match;
        let oldClient = client;
        let clientId;
        if (!client) {
            try {
                const clientResponse = await createClient(clientInput, options);
                client = clientResponse.createClient;
                if (!isClient(client)) {
                    throw new Error(`Created client missing required fields: ${JSON.stringify(client)}`);
                }
                detailedResult.clientsCreated.push({
                    inputRecord: clientInput,
                    createdClient: client
                });
            } catch (err) {
                detailedResult.clientsFailed.push({
                    inputRecord: clientInput,
                    error: err instanceof Error ? err.message : String(err),
                    timestamp: new Date().toISOString()
                });

                console.error(`Error creating client for ${clientInput.givenName} ${clientInput.familyName}:`, err);
                continue;
            }
        } else {
            clientId = client.id;

            if (!isClient(client)) {
                throw new Error(`Existing client missing required fields: ${JSON.stringify(client)}`);
            }

            // @ts-ignore
            if (!deepEqual(clientInput, client)) {
                try {
                    const { id: _, ...clientRest } = client;
                    const newInput = { ...clientRest, ...clientInput }
                    const clientResponse = await updateClient(clientId, newInput, options) as { updateClient: Client };
                    oldClient = client;
                    client = clientResponse.updateClient;
                    if (!isClient(client)) {
                        throw new Error(`Updated client missing required fields: ${JSON.stringify(client)}`);
                    }
                    detailedResult.clientsUpdated.push({
                        inputRecord: clientInput,
                        updatedClient: client,
                        oldClient
                    });
                } catch (err) {
                    detailedResult.clientsFailed.push({
                        inputRecord: clientInput,
                        error: err instanceof Error ? err.message : String(err),
                        timestamp: new Date().toISOString()
                    });

                    console.error(`Error updating client for ${clientInput.givenName} ${clientInput.familyName}:`, err);
                }
            } else {
                detailedResult.clientsSkipped.push({
                    inputRecord: clientInput
                });
            }
        }
        clientId = clientId || client.id;

        let patient = findPatientMatch(patientInput, clientId, existingPatients)?.match;
        let oldPatient = patient;
        let patientFailure = {
            ...patientInput,
            email: clientInput.email || `${clientInput.givenName} ${clientInput.familyName}` as string
        };
        if (!patient) {
            try {
                const patientResponse = await createPatient(clientId, patientInput, options);
                patient = patientResponse.createPatient;

                // Validate patient response and track if requested
                if (!isPatient(patient)) {
                    throw new Error(`Created patient missing required fields: ${JSON.stringify(patient)}`);
                }
                detailedResult.patientsCreated.push({
                    inputRecord: patientInput,
                    createdPatient: patient
                });
            } catch (err) {
                detailedResult.patientsFailed.push({
                    inputRecord: patientFailure,
                    error: err instanceof Error ? err.message : String(err),
                    timestamp: new Date().toISOString()
                });

                console.error(`Error creating patient ${patientInput.name} for client ${clientInput.givenName} ${clientInput.familyName}:`, err);
                continue;
            }
        } else {
            if (!isPatient(patient)) {
                throw new Error(`Existing patient missing required fields: ${JSON.stringify(patient)}`);
            }

            // @ts-ignore
            if (!deepEqual(patientInput, patient)) {
                try {
                    const patientResponse = await updatePatient(patient.id, patientInput, options) as { updatePatient: Patient };
                    patient = patientResponse.updatePatient;

                    if (!isPatient(patient)) throw new Error(`Updated patient missing required fields: ${JSON.stringify(patient)}`);
                    detailedResult.patientsUpdated.push({
                        inputRecord: patientInput,
                        updatedPatient: patient,
                        oldPatient
                    });
                } catch (err) {
                    detailedResult.patientsFailed.push({
                        inputRecord: patientFailure,
                        error: err instanceof Error ? err.message : String(err),
                        timestamp: new Date().toISOString()
                    });

                    console.error(`Error updating patient ${patientInput.name} for client ${clientInput.givenName} ${clientInput.familyName}:`, err);
                }
            } else {
                detailedResult.patientsSkipped.push({
                    inputRecord: patientFailure
                });
            }
        }

        // Emit progress every 10 records
        if ((i + 1) % 10 === 0 || i === records.length - 1) {

            const totalSuccessful = detailedResult.clientsCreated.length + detailedResult.patientsCreated.length;
            const totalFailed = detailedResult.clientsFailed.length + detailedResult.patientsFailed.length;
            const totalSkipped = detailedResult.clientsSkipped.length + detailedResult.patientsSkipped.length;
            const totalUpdated = detailedResult.clientsUpdated.length + detailedResult.patientsUpdated.length;
            console.log(`Progress: Processed ${i + 1} of ${records.length} records. ${totalSuccessful} (+${totalSuccessful - lastSuccessful}) successful, ${totalFailed} failed (+${totalFailed - lastFailed}), ${totalUpdated} updated (+${totalUpdated - lastUpdated}), ${totalSkipped} skipped (+${totalSkipped - lastSkipped}).`);

            lastSuccessful = totalSuccessful;
            lastFailed = totalFailed;
            lastSkipped = totalSkipped;
            lastUpdated = totalUpdated;
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
            const { givenName, familyName, email } = c.inputRecord;
            console.log(`- ${givenName} ${familyName} (${email})`);
        });
    }
    if (detailedResult.patientsFailed.length > 0) {
        console.log('Failed to create patients:');
        detailedResult.patientsFailed.forEach(p => {
            const { name, email } = p.inputRecord;
            console.log(`- ${name} (${email})`);
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

    return detailedResult;
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

// Immunization helpers moved to src/services/immunizationLookup.ts to avoid heavy imports in ESM runtime
