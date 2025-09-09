import { describe, it, expect, afterAll } from 'vitest';
import { promisify } from 'util';
import { exec as _exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ClientImportRow } from '../src/types';
import { readCsvFile } from '../src/services/csvHandler';
import { expectToBeDefined } from './test-helpers';
import { extractTextFromPdf } from '../src/clients/pdfClient';
import { parseVaccineLots, parseVaccineRecords, writeVaccineRowsToJSON } from '../src/services/pdfParser';

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

// Additional integration tests for vaccine_export.pdf parsing
describe.only('Vaccine PDF Parsing (integration)', () => {
    const vaccinePdf = path.resolve('./vaccine_export.pdf');
    const outputsDir = path.resolve('./outputs');

    it('parses the first two lot groups from the sample PDF', async () => {
        if (!fs.existsSync(vaccinePdf)) {
            console.warn('Skipping test: vaccine_export.pdf not found at', vaccinePdf);
            return;
        }

        const text = await extractTextFromPdf(vaccinePdf);
        const lots = parseVaccineLots(text);
        expect(lots.length).toBeGreaterThan(0);

        // First lot is the error batch (empty lot/manufacturer)
        expect(lots[0]).toEqual({ lotNumber: '', manufacturer: '', expiryDate: '' });
        // Second lot
        expect(lots[1].lotNumber).toBe('01211821C');
        expect(lots[1].manufacturer.toLowerCase()).toContain('intervet');
    }, 60_000);

    it('verifies five rows in second lot with expected dates', async () => {
        if (!fs.existsSync(vaccinePdf)) return;

        const text = await extractTextFromPdf(vaccinePdf);
        const lots = parseVaccineLots(text);
        const rows = parseVaccineRecords(text);
        expect(lots.length).toBeGreaterThan(1);
        const lot2 = lots[1];
        const lot2Rows = rows.filter(r => r.lotNumber === lot2.lotNumber);
        expect(lot2Rows.length).toBeGreaterThanOrEqual(5);

        const expected = [
            { patient: 'Frankie', family: 'Rodriguez', given: 'Christian', dateGiven: '2019-12-07', dateDue: '2020-12-06' },
            { patient: 'Archie', family: 'Naylor', given: 'Madigan', dateGiven: '2019-11-19', dateDue: '2020-11-18' },
            { patient: 'Gaspard', family: 'Murphy', given: 'Sara', dateGiven: '2019-11-12', dateDue: '2020-11-11' },
            { patient: 'Toby', family: 'Francus', given: 'Helena', dateGiven: '2019-12-10', dateDue: '2020-12-09' },
            { patient: 'Oscar', family: 'Feuer', given: 'Lindsay', dateGiven: '2019-12-07', dateDue: '2020-12-06' },
        ];

        for (const e of expected) {
            const m = lot2Rows.find(r =>
                r.patientName === e.patient &&
                r.clientFamilyName === e.family &&
                r.clientGivenName === e.given
            );
            expect(m, `Missing expected row for ${e.patient} (${e.family}, ${e.given})`).toBeDefined();
            if (m) {
                expect(m.description.toLowerCase()).toContain('da2/cpv');
                expect(m.dateGiven).toBe(e.dateGiven);
                expect(m.dateDue).toBe(e.dateDue);
            }
        }
    }, 60_000);

    it('parses rows and writes JSON output', async () => {
        if (!fs.existsSync(vaccinePdf)) return;

        const text = await extractTextFromPdf(vaccinePdf);
        const rows = parseVaccineRecords(text);
        expect(rows.length).toBeGreaterThan(0);

        // Spot-check a couple of recognizable entries
        const daisy = rows.find(r => r.patientName === 'Daisy' && r.clientFamilyName === 'Smith' && r.clientGivenName === 'Gina');
        expect(daisy).toBeDefined();
        if (daisy) {
            expect(daisy.description.toLowerCase()).toContain('lymes');
            expect(daisy.dateGiven <= (daisy.dateDue || daisy.dateGiven)).toBe(true);
        }

        const lucky = rows.find(r => r.patientName === 'Lucky' && r.clientFamilyName === 'Mena' && r.clientGivenName === 'Brianna');
        expect(lucky).toBeDefined();
        if (lucky) {
            expect(lucky.description.toLowerCase()).toContain('intranasal');
        }

        const jsonPath = writeVaccineRowsToJSON(rows, outputsDir);
        expect(fs.existsSync(jsonPath)).toBe(true);
    }, 60_000);
});
