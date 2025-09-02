import { describe, it, expect, afterAll } from 'vitest';
import { promisify } from 'util';
import { exec as _exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ClientImportRow } from '../src/types';
import { readCsvFile } from '../src/services/csvHandler';
import { expectToBeDefined } from './test-helpers';

const exec = promisify(_exec);
const outputsDir = path.resolve('./outputs');
const sourcePdf = path.resolve('./advantage_labeled_export.pdf');
const filePrefix = 'client-patient-records_';
const createdFiles: string[] = [];

// Honor a --no-cleanup flag passed to the test runner or NO_CLEANUP=1 env var
console.log('process.argv: ', process.argv);
const noCleanup = process.argv.includes('--no-cleanup') || process.env.NO_CLEANUP === '1';

const EXPECTED_RESULTS: ClientImportRow[] = [
    {
        patientId: '5987',
        patientName: 'Abby',
        patientSpecies: 'Canine',
        patientBreed: 'Mixed',
        patientSexSpay: 'FS',
        clientId: '2273',
        clientFirstName: 'Jeanne',
        clientLastName: 'Delorenzo',
        clientPhone: '(212) 249-5280',
        clientEmail: '',
        patientWeight: '39.7',
        clientStreetAddr: '500 East 83rd Street 9D',
        patientColor: 'Black - White',
        patientDOB: '2/20/2008',
        clientPostCode: '10028',
        clientCity: 'New York',
        patientStatus: 'ND',
        clientState: 'NY'
    },
    {
        patientId: '4417',
        patientName: 'Gizmo',
        patientSpecies: 'Canine',
        patientBreed: 'Shih Tzu',
        patientSexSpay: 'MN',
        clientId: '2',
        clientFirstName: 'Lily',
        clientLastName: 'Doloroso',
        clientPhone: '',
        clientEmail: '',
        patientWeight: '7.01',
        clientStreetAddr: '',
        patientColor: 'Black - White',
        patientDOB: '3/1/2006',
        clientPostCode: '',
        clientCity: '',
        patientStatus: 'ND',
        clientState: 'NY'
    }
]
describe('convert-pdf CLI (integration)', () => {
    it('runs convert-pdf on advantage PDF and produces a timestamped CSV with expected header', async () => {
        // Skip if sample PDF not available
        if (!fs.existsSync(sourcePdf)) {
            console.warn('Skipping test: sample PDF not found at', sourcePdf);
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Ensure outputs dir exists
        if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

        const before = new Set(fs.readdirSync(outputsDir));

        // Run CLI via npm script (uses tsx per package.json).
        const cmd = `npm run convert-pdf -- ${sourcePdf}`;

        const { stdout, stderr } = await exec(cmd, { timeout: 120_000 });
        console.log('convert-pdf stdout:', stdout);
        console.error('convert-pdf stderr:', stderr);

        const after = fs.readdirSync(outputsDir);
        const newFiles = after.filter(f => !before.has(f) && f.startsWith(filePrefix));

        expect(newFiles.length).toBeGreaterThan(0);
        for (const f of newFiles) {
            const full = path.join(outputsDir, f);
            const contents = fs.readFileSync(full, 'utf-8');
            expect(contents.length).toBeGreaterThan(0);

            // Assert CSV header contains expected columns
            const firstLine = contents.split('\n')[0] || '';
            expect(firstLine).toContain('patientId');
            expect(firstLine).toContain('patientName');

            createdFiles.push(full);
        }

        // Verify that when the CSV is read back in as ClientInputRows, the complete
        // array includes our EXPECTED_RESULTS somewhere.
        console.log('Reading CSV file:', path.join(outputsDir, newFiles[0]));
        const importedRows = readCsvFile(path.join(outputsDir, newFiles[0]));
        for (const expected of EXPECTED_RESULTS) {
            // Search by first and last name from our EXPECTED_RESULTS to see if
            // similar records are present
            const found = importedRows.find(row =>
                row.clientFirstName === expected.clientFirstName &&
                row.clientLastName === expected.clientLastName &&
                row.patientName === expected.patientName
            );
            expectToBeDefined(found, `Could not find expected record for ${expected.clientFirstName} ${expected.clientLastName} (${expected.patientName})`);

            // For each of those records, check that every one of our expected keys
            // matches the real value
            for (const key of Object.keys(expected)) {
                // If assertion fails, also print the client's firstname, lastname
                // and patient name to help identify the error position
                expect(found[key], `Error in record for ${found.clientFirstName} ${found.clientLastName} (${found.patientName})`).toEqual(expected[key]);
            }
        }
    }, 120_000);
});

afterAll(() => {
    // if (noCleanup) {
    //     console.log('Skipping test cleanup because --no-cleanup was provided');
    //     return;
    // }
    // for (const p of createdFiles) {
    //     try {
    //         if (fs.existsSync(p)) {
    //             fs.unlinkSync(p);
    //         }
    //     } catch (err) {
    //         console.warn('Failed to delete test artifact:', p, err);
    //     }
    // }
});
