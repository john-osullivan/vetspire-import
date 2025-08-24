import { ClientImportRow } from "../types/clientTypes";
import { transformToClientInput, transformToPatientInput } from "./transformer.js";
import { createClient, createPatient } from "../clients/apiClient.js";

export async function processOne(record: ClientImportRow) {
    try {
        // Transform the record into API-compatible formats
        const clientInput = transformToClientInput(record);
        const patientInput = transformToPatientInput(record);

        // Create client first, then patient
        const clientResponse = await createClient(clientInput);
        const patientResponse = await createPatient(clientResponse.createClient.id, patientInput);

        console.log(`Created a ${patientInput.species} named ${patientInput.name}, owned by ${clientInput.givenName} ${clientInput.familyName}`);
        
        return {
            client: clientResponse.createClient,
            patient: patientResponse.createPatient
        };
    } catch (err) {
        // Log something like "Error processing [Virginia's] [Teacup] the [feline]"
        console.error(`Error processing ${record.clientFirstName}'s ${record.patientSpecies}, ${record.patientName}:\n\n`, err);
        throw err;
    }
}

export async function processAll(records: ClientImportRow[]) {
    for (const record of records) {
        await processOne(record);
    }
}