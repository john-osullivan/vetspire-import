#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { updateImportedPrimaryLocations } from '../services/importer.js';
import { ImportOptions } from '../types/importOptions';

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('full-send', {
            alias: 'f',
            type: 'boolean',
            description: 'Actually send API requests (not a dry run)',
            default: false
        })
        .option('uptown', {
            alias: 'u',
            type: 'boolean',
            description: 'Use real location mapping when updating',
            default: false
        })
        .option('verbose', {
            alias: 'v',
            type: 'boolean',
            description: 'Print request and response bodies for every API call',
            default: false
        })
        .help()
        .argv;

    if (!process.env.REAL_LOCATION_ID) {
        console.error('Missing required environment variable: REAL_LOCATION_ID');
        process.exit(1);
    }

    const options: ImportOptions = {
        sendApiRequests: argv['full-send'] as boolean,
        verbose: argv.verbose as boolean
    };

    try {
        await updateImportedPrimaryLocations(options);
    } catch (err) {
        console.error('Error running update-import:', err);
        process.exit(1);
    }
}

main();
