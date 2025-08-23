#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { extractTextFromPdf } from '../clients/pdfClient.js';

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
    
    // For now, just output first 1000 characters to examine structure
    console.log('First 1000 characters:');
    console.log(text.substring(0, 1000));
    console.log('\n...\n');
    console.log('Last 1000 characters:');
    console.log(text.substring(text.length - 1000));
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    process.exit(1);
  }
}

main();