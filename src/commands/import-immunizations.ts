#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import path from 'path';
import { processImmunizationProposals } from '../services/importer.js';
import { ImmunizationDraft } from '../types/apiTypes.js';
import { ImportOptions } from '../types/importOptions.js';

type ProposalsFile = { proposals: ImmunizationDraft[] } | ImmunizationDraft[];

function readProposals(filePath: string): ImmunizationDraft[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data: ProposalsFile = JSON.parse(raw);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as any).proposals)) return (data as any).proposals;
  throw new Error('Invalid proposals file format: expected array or { proposals: [] }');
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command('$0 <proposals-file>', 'Import immunizations from proposals JSON', (y) =>
      y.positional('proposals-file', {
        describe: 'Path to immunization proposals JSON',
        type: 'string',
        demandOption: true,
      })
    )
    .option('full-send', {
      alias: 'f',
      type: 'boolean',
      default: false,
      describe: 'Actually send API requests',
    })
    .option('limit', {
      alias: 'l',
      type: 'number',
      default: undefined,
      describe: 'Limit number of proposals to process',
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      default: false,
      describe: 'Verbose GraphQL logging',
    })
    .help()
    .argv;

  const filePath = argv['proposals-file'] as string;
  if (!fs.existsSync(filePath)) {
    console.error('File does not exist:', filePath);
    process.exit(1);
  }

  if (!process.env.REAL_LOCATION_ID) {
    console.error('Missing env: REAL_LOCATION_ID');
    process.exit(1);
  }
  if (!process.env.PROVIDER_ID) {
    console.error('Missing env: PROVIDER_ID');
    process.exit(1);
  }

  const all = readProposals(filePath);
  const proposals = typeof argv.limit === 'number' ? all.slice(0, argv.limit) : all;

  console.log(`Loaded ${all.length} proposals from ${path.resolve(filePath)}`);
  if (argv.limit) console.log(`Processing first ${proposals.length} (limit applied)`);

  const options: ImportOptions = {
    sendApiRequests: argv['full-send'] as boolean,
    verbose: argv.verbose as boolean,
    // Results are always written inside the importer
    trackResults: true,
  };

  if (options.sendApiRequests) {
    console.log('=〉 FULL SEND MODE — real API calls enabled');
  } else {
    console.log('>〉 DRY RUN MODE — no real API calls');
  }

  try {
    await processImmunizationProposals(proposals, options);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
}

main();

