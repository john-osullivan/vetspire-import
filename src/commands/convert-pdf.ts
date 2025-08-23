#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { extractTextFromPdf } from '../clients/pdfClient.js';
import { parseClientPatientRecords } from '../services/pdfParser.js';
import { writeRecordsToCSV } from '../services/csvWriter.js';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command(
      '$0 <pdf-file>',
      'Convert PDF to CSV',
      (yargs) => {
        return yargs.positional('pdf-file', {
          describe: 'Path to the PDF file to convert',
          type: 'string',
          demandOption: true
        });
      }
    )
    .option('output', {
      alias: 'o',
      type: 'string',
      description: 'Output directory',
      default: './outputs'
    })
    .help()
    .argv;

  try {
    console.log(`Extracting text from: ${argv['pdf-file']}`);
    const text = await extractTextFromPdf(argv['pdf-file'] as string);
    
    console.log('Parsing client-patient records...');
    const records = parseClientPatientRecords(text);
    
    console.log(`Found ${records.length} client-patient records`);
    
    const csvPath = writeRecordsToCSV(records, argv.output as string);
    console.log(`CSV written to: ${csvPath}`);
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    process.exit(1);
  }
}

main();