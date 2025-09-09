#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import path from 'path';
import { extractTextFromPdf } from '../clients/pdfClient.js';
import { parseVaccineRecords, parseVaccineRecordsStructured, writeVaccineRowsToJSON } from '../services/pdfParser.js';
import { extractPdf2Json } from '../clients/pdf2jsonClient.js';
import { buildPatientLookup, patientClientKey } from '../services/immunizationLookup.js';
import { toImmunizationDraft } from '../services/transformer.js';

type Proposal = ReturnType<typeof toImmunizationDraft>;

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command('$0 <pdf-file>', 'Propose immunizations from a vaccine report PDF', y =>
      y.positional('pdf-file', {
        describe: 'Path to the vaccine PDF',
        type: 'string',
        demandOption: true,
      })
    )
    .option('output', {
      alias: 'o',
      type: 'string',
      default: './outputs',
      describe: 'Output directory for proposals JSON',
    })
    .option('fetch', {
      type: 'boolean',
      default: true,
      describe: 'Fetch existing patients to resolve patient IDs',
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      default: false,
    })
    .option('structured', {
      type: 'boolean',
      default: false,
      describe: 'Prefer pdf2json structured parsing if available',
    })
    .option('dump-rows', {
      type: 'boolean',
      default: false,
      describe: 'Write parsed rows JSON alongside proposals for manual review',
    })
    .help()
    .argv;

  const pdfPath = argv['pdf-file'] as string;
  const outputDir = argv.output as string;
  const doFetch = argv.fetch as boolean;
  const verbose = argv.verbose as boolean;
  const preferStructured = argv.structured as boolean;
  const dumpRows = argv['dump-rows'] as boolean;

  if (!fs.existsSync(pdfPath)) {
    console.error('File does not exist:', pdfPath);
    process.exit(1);
  }

  console.log(`Reading vaccine PDF: ${pdfPath}`);
  let rows;
  if (preferStructured) {
    const doc = await extractPdf2Json(pdfPath);
    if (doc) {
      rows = parseVaccineRecordsStructured(doc);
      console.log(`Parsed with pdf2json (structured)`);
    } else {
      console.warn('pdf2json not available. Falling back to text parser. Install with: npm i pdf2json');
      const text = await extractTextFromPdf(pdfPath);
      rows = parseVaccineRecords(text);
    }
  } else {
    const text = await extractTextFromPdf(pdfPath);
    rows = parseVaccineRecords(text);
  }
  console.log(`Parsed ${rows.length} vaccine delivery rows`);

  if (dumpRows) {
    const rowsPath = writeVaccineRowsToJSON(rows, outputDir);
    console.log('Parsed rows written to:', rowsPath);
  }

  let patientLookup = new Map<string, string>();
  if (doFetch) {
    console.log('Fetching existing patients for lookup...');
    const { fetchAllExistingRecords } = await import('../clients/apiClient.js');
    const { patients } = await fetchAllExistingRecords(true);
    patientLookup = buildPatientLookup(patients as any);
    console.log(`Built lookup with ${patientLookup.size} keys`);
  } else {
    console.log('Skipping patient fetch (no-fetch mode). Proposals will be unmatched.');
  }

  const proposals: Proposal[] = [];
  const unmatched: Array<{ key: string; row: any; reason: 'no_match' }> = [];

  for (const row of rows) {
    const key = patientClientKey(row.patientName, row.clientFamilyName, row.clientGivenName);
    const patientId = patientLookup.get(key);

    if (!patientId) {
      unmatched.push({
        key,
        row: {
          dateGiven: row.dateGiven,
          dateDue: row.dateDue,
          patientName: row.patientName,
          clientGivenName: row.clientGivenName,
          clientFamilyName: row.clientFamilyName,
          description: row.description,
          lotNumber: row.lotNumber,
          manufacturer: row.manufacturer,
          expiryDate: row.expiryDate,
        },
        reason: 'no_match',
      });
      continue;
    }

    const draft = toImmunizationDraft(row, patientId);
    proposals.push(draft);
    if (verbose && proposals.length % 50 === 0) {
      console.log(`Prepared ${proposals.length} proposals so far...`);
    }
  }

  // Prepare output
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outPath = path.join(outputDir, `immunization-proposals_${timestamp}.json`);

  const payload = {
    meta: {
      timestamp: new Date().toISOString(),
      sourcePdf: path.resolve(pdfPath),
      totalRows: rows.length,
      totalProposals: proposals.length,
      totalUnmatched: unmatched.length,
      usedLookup: doFetch,
      locationIdPresent: !!process.env.REAL_LOCATION_ID,
      providerIdPresent: !!process.env.PROVIDER_ID,
    },
    proposals,
    unmatched,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log('Proposals written to:', outPath);
}

main().catch((err) => {
  console.error('Failed to propose immunizations:', err);
  process.exit(1);
});
