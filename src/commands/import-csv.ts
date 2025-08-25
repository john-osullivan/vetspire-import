#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { readCsvFile } from '../services/csvHandler.js';
import { processAll } from '../services/importer.js';

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .positional('csv-file', {
            describe: 'Path to the CSV file to import',
            type: 'string',
            demandOption: true
        })
        .option('full-send', {
            alias: 'f',
            type: 'boolean',
            description: 'Actually send API requests (not a dry run)',
            default: false
        })
        .option('uptown', {
            alias: 'u',
            type: 'boolean',
            description: 'Send to Uptown Vets (real location) instead of test location',
            default: false
        })
        .option('limit', {
            alias: 'l',
            type: 'number',
            description: 'Limit number of records to process (for testing)',
            default: undefined
        })
        .strict(false)
        .parserConfiguration({ 'populate--': true })
        .help()
        .example('$0 data.csv', 'Dry run import from data.csv (test location)')
        .example('$0 --full-send =ata.csv', 'Actually import data from data.csv (test location)')
        .example('$0 --uptown data.csv', 'Dry run to Uptown Vets (real location)')
        .example('$0 --full-send --uptown data.csv', 'Actually import to Uptown Vets')
        .example('$0 --limit 10 data.csv', 'Dry run first 10 records only')
        .example('$0 data.csv --limit 10', 'Options can be placed before or after the CSV file')
        .argv;

    try {
        const csvFile = argv['csv-file'] || argv._[0] as string;
        console.log(`Reading CSV file: ${csvFile}`);
        console.log('argv: ', JSON.stringify(argv, null, 2));
        const records = readCsvFile(csvFile);
        console.log(`Found ${records.length} client-patient records`);

        // Limit records if specified
        const recordsToProcess = argv.limit ? records.slice(0, argv.limit) : records;

        if (argv.limit) {
            console.log(`Processing first ${recordsToProcess.length} records (limit applied)`);
        }

        const sendApiRequests = argv['full-send'] as boolean;
        const useRealLocation = argv.uptown as boolean;

        if (sendApiRequests) {
            console.log('=� FULL SEND MODE - Making real API calls!');
        } else {
            console.log('>� DRY RUN MODE - No real API calls will be made');
        }

        console.log('Processing records...\n');

        const results = await processAll(recordsToProcess, sendApiRequests, useRealLocation);

        console.log(`\n Import completed!`);
        if (!sendApiRequests) {
            console.log('   (This was a dry run - use --full-send to actually import)');
        }

    } catch (error) {
        console.error('Error importing CSV:', error);
        process.exit(1);
    }
}

main();