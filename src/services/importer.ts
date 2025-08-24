import { ClientImportRow } from "../types/clientTypes";

export async function processOne(record: ClientImportRow) {
    try {

    } catch (err) {
        // Log something like "Error processing [Virginia's] [Teacup] the [feline]"
        console.error(`Error processing ${record.clientFirstName}'s ${record.patientSpecies}, ${record.patientName}:\n\n`, err);
    }
}

export async function processAll(records: ClientImportRow[]) {
    for (const record of records) {
        await processOne(record);
    }
}