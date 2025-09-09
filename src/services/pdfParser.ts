import fs from 'fs';
import { ClientImportRow, EMPTY_CLIENT } from '../types/clientTypes.js';
const IMPORT_KEYS = Object.keys(EMPTY_CLIENT);

export function parseClientPatientRecords(pdfText: string): ClientImportRow[] {
  const records: ClientImportRow[] = [];
  const lines = pdfText.split('\n').map(line => line.trim()).filter(line => line);

  // Some of these lines include erroneous values where 2 key
  // lines should've been split but weren't. For example, the line
  // `clientStreetAddrpatientWeight` needs to be converted into 
  // 2 lines, `clientStreetAddr` and `patientWeight`.
  lines.forEach((line, index) => {
    IMPORT_KEYS.forEach(key => {
      if (line.startsWith(key) && line.length > key.length) {
        const firstKey = line.slice(0, key.length);
        const secondKey = line.slice(key.length);
        lines[index] = firstKey;
        lines.splice(index + 1, 0, secondKey);
      }
    })
  });

  fs.writeFileSync('./outputs/parsed_lines.json', JSON.stringify(lines, null, 2));
  let currentRecord: ClientImportRow | null = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line is a key (next line should be the value)
    if (i + 1 < lines.length) {
      const key = line;
      const value = lines[i + 1];

      // If we encounter a patientId key, start a new record
      if (key === 'patientId') {
        // Save previous record if it exists and has required fields
        if (currentRecord && currentRecord.patientId && currentRecord.patientName) {
          records.push(currentRecord);
        }

        // Start new record
        currentRecord = { ...EMPTY_CLIENT };
        currentRecord.patientId = value;
        i += 2; // Skip both key and value lines
        continue;
      }

      // If we have a current record and this is a valid key, add the field
      if (currentRecord && Object.keys(EMPTY_CLIENT).includes(key)) {
        // assign via intermediate record to satisfy typing
        const rec = currentRecord as unknown as Record<string, unknown>;
        if (Object.keys(EMPTY_CLIENT).includes(value)) {
          // If the next non-blank line is a key, then the current key
          // has no value for this record. Add nothing, advance i by only 1
          // so that we might import the next row.
          rec[key] = null;
          i += 1;
        } else {
          rec[key] = typeof value === 'string' ? value : null;
          i += 2; // Skip both key and value lines
        }
        continue;
      }
    }

    // If we get here, skip this line (might be whitespace or unexpected content)
    i++;
  }

  // Don't forget to add the last record
  if (currentRecord && currentRecord.patientId && currentRecord.patientName) {
    records.push(currentRecord);
  }

  return records;
}

// =========================
// Immunization PDF Parsing
// =========================

export interface VaccineDeliveryRow {
  dateGiven: string;         // YYYY-MM-DD
  dateDue?: string;          // YYYY-MM-DD
  patientName: string;
  clientGivenName: string;
  clientFamilyName: string;
  description: string;
  lotNumber: string;         // may be '' for first error batch
  manufacturer: string;      // may be '' for first error batch
  expiryDate: string;        // YYYY-MM-DD or '' if unknown
}

export interface VaccineLotMeta {
  lotNumber: string;
  manufacturer: string;
  expiryDate: string; // YYYY-MM-DD or ''
}

// Shared helpers
export function splitColumnsBySpacing(line: string): string[] {
  return line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
}

export function normalizeMmDdYyyy(mdy?: string): string | undefined {
  if (!mdy) return undefined;
  const match = mdy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, m, d, y] = match;
  const iso = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  if (isNaN(iso.getTime())) return undefined;
  return iso.toISOString().slice(0, 10);
}

function isTableHeader(line: string): boolean {
  const l = line.toLowerCase();
  return l.includes('patient name') && l.includes('client name') && l.includes('date');
}

function isTotalsRow(line: string): boolean {
  return /^total number of vaccinations/i.test(line);
}

function isDateLike(line: string): boolean {
  return /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(line);
}

function looksLikeLotNumber(line: string): boolean {
  // Accept compact tokens (no spaces), at least one digit, optional letters or hyphens
  const compact = line.trim();
  if (!/^[A-Za-z0-9\-]{3,}$/.test(compact)) return false;
  if (!/[0-9]/.test(compact)) return false; // must contain a digit
  // Digits-only are allowed if reasonably long (avoid totals like 108)
  if (/^[0-9]+$/.test(compact) && compact.length < 5) return false;
  if (compact.includes(' ')) return false;
  // Avoid obvious headers or words
  if (/^page\b/i.test(compact)) return false;
  if (/^category\b/i.test(compact)) return false;
  if (/^period\b/i.test(compact)) return false;
  if (/^expires\b/i.test(compact)) return false;
  if (/^lot\s*#?\s*manufacturer/i.test(compact)) return false;
  if (isDateLike(compact)) return false;
  // Exclude commas or slashes
  if (/[,\/]/.test(compact)) return false;
  return true;
}

function looksLikeManufacturer(line: string): boolean {
  const s = line.trim();
  if (!/[A-Za-z]/.test(s)) return false;
  if (/[0-9]/.test(s)) return false; // manufacturer shouldn't include digits
  if (/[\/]/.test(s)) return false; // no slashes
  if (isDateLike(s)) return false;
  if (/^lot\s*#?\s*manufacturer/i.test(s)) return false;
  if (/^date\b/i.test(s)) return false; // Date Given
  if (/^expires\b/i.test(s)) return false; // header line
  if (/^date\s*due\b/i.test(s)) return false; // Date Due Patient name ...
  if (/^page\b/i.test(s)) return false;
  if (/^category\b/i.test(s)) return false;
  if (/^serum by/i.test(s)) return false;
  if (/^period\b/i.test(s)) return false;
  if (/^printed/i.test(s) || /run by/i.test(s)) return false;
  if (/^total number of vaccinations/i.test(s)) return false;
  return true;
}

function collectLotMeta(lines: string[], startIndex: number): VaccineLotMeta | null {
  // Scan a small window around the header for lotNumber/manufacturer/expiry
  let lotNumber: string | undefined;
  let manufacturer: string | undefined;
  let expiryDate: string | undefined;

  // Look back a couple lines for a standalone lot number
  for (let back = 1; back <= 3; back++) {
    const idx = startIndex - back;
    if (idx >= 0 && looksLikeLotNumber(lines[idx])) {
      lotNumber = lines[idx];
      break;
    }
  }

  const window = lines.slice(startIndex + 1, Math.min(lines.length, startIndex + 8));
  for (const text of window) {
    if (!manufacturer && looksLikeManufacturer(text)) {
      manufacturer = text;
      continue;
    }
    if (!expiryDate) {
      const normalized = normalizeMmDdYyyy(text);
      if (normalized) {
        expiryDate = normalized;
        continue;
      }
    }
    if (!lotNumber && looksLikeLotNumber(text)) {
      lotNumber = text;
      continue;
    }
    // Skip header lines but continue scanning to capture single-line expiry
    if (isTableHeader(text)) continue;
  }

  if (!manufacturer && !lotNumber) return null;
  return { lotNumber: lotNumber || '', manufacturer: manufacturer || '', expiryDate: expiryDate || '' };
}

// Extract just the lot grouping metadata in order of appearance
export function parseVaccineLots(pdfText: string): VaccineLotMeta[] {
  const lots: VaccineLotMeta[] = [];
  const lines = pdfText.split('\n').map(l => l.trim()).filter(Boolean);

  let encounteredAnyLot = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    if (/^lot\s*#?\s*manufacturer/i.test(line)) {
      const meta = collectLotMeta(lines, lineIndex);
      if (meta && meta.lotNumber) {
        lots.push(meta);
        encounteredAnyLot = true;
      } else if (!encounteredAnyLot) {
        // First batch may be error rows with missing lot/manufacturer
        lots.push({ lotNumber: '', manufacturer: '', expiryDate: '' });
        encounteredAnyLot = true;
      }
    }
  }

  return lots;
}

// Full row parsing – scaffolded for future expansion, not used by tests yet
function isDateToken(token: string): boolean {
  const parts = token.split('/');
  if (parts.length !== 3) return false;
  const [m, d, y] = parts;
  if (!/^[0-9]{1,2}$/.test(m)) return false;
  if (!/^[0-9]{1,2}$/.test(d)) return false;
  if (!/^[0-9]{4}$/.test(y)) return false;
  return true;
}

function consumeDateAtStart(text: string): { date: string; rest: string } | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^(\d{1,2}\/\d{1,2}\/\d{4})(.*)$/);
  if (!m) return null;
  const [, date, rest] = m;
  return { date, rest: rest.trimStart() };
}

function extractLeadingDates(line: string): { first: string; second: string; rest: string } | null {
  const first = consumeDateAtStart(line);
  if (!first) return null;
  const second = consumeDateAtStart(first.rest);
  if (!second) return null;
  return { first: first.date, second: second.date, rest: second.rest };
}

function normalizeGivenAndDue(d1: string, d2: string): { dateGiven: string; dateDue: string } {
  const n1 = normalizeMmDdYyyy(d1) || d1;
  const n2 = normalizeMmDdYyyy(d2) || d2;
  // Assume given is earlier or equal, due is later
  if (n1 <= n2) return { dateGiven: n1, dateDue: n2 };
  return { dateGiven: n2, dateDue: n1 };
}

function findClientAtLineEnd(text: string): { clientFamilyName: string; clientGivenName: string; beforeClient: string } | null {
  const compact = text.trim().replace(/\s+/g, ' ');
  const lastCommaIndex = compact.lastIndexOf(',');
  if (lastCommaIndex === -1) return null;

  const leftSide = compact.slice(0, lastCommaIndex).trim();
  const rightSide = compact.slice(lastCommaIndex + 1).trim();

  // Family name is the trailing ProperCase token at end of leftSide (e.g., Ankuda in AnnualSDSadieAnkuda)
  const familyMatch = leftSide.match(/([A-Z][a-z'()\-]+)$/);
  if (!familyMatch) return null;
  const family = familyMatch[1];
  const beforeClient = leftSide.slice(0, leftSide.length - family.length).trim();
  const given = rightSide;

  if (!family || !given) return null;
  if (/[0-9]/.test(given)) return null;

  return { clientFamilyName: family, clientGivenName: given, beforeClient };
}

function stripTrailingTagNumber(text: string): { withoutTag: string } {
  // Normalize hyphens
  let s = text.trim().replace(/\s*[-–]\s*/g, '-');
  // Remove trailing tag forms like ...123-45 or ...123--45
  s = s.replace(/(\d{2,4})(?:--|-)\d{2}$/, '').trim();
  return { withoutTag: s };
}

function isNameToken(token: string): boolean {
  return /^[A-Za-z][A-Za-z'()\-]*$/.test(token);
}

function stripTrailingProviderCode(desc: string): string {
  let s = desc.trim();
  // Remove trailing uppercase codes like SD, KKD, SD1, etc., glued or spaced
  while (true) {
    const m = s.match(/([A-Z]{2,4}[0-9]?)$/);
    if (!m) break;
    s = s.slice(0, -m[1].length).trim();
  }
  return s;
}

function extractPatientAndDescription(text: string): { patientName: string; description: string } {
  const trimmed = text.trim();

  // Prefer trailing ProperCase name sequence (supports multi-word names)
  const tailSeq = trimmed.match(/([A-Z][a-z'()\-]+(?:\s+[A-Z][a-z'()\-]+)*)$/);
  if (tailSeq) {
    const patientName = tailSeq[1];
    let description = trimmed.slice(0, trimmed.length - patientName.length).trim();
    description = stripTrailingProviderCode(description);
    if (!description) description = 'Unknown (Legacy)';
    return { patientName, description };
  }

  // Fallback: token-based split
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  let end = tokens.length - 1;
  while (end >= 0 && isNameToken(tokens[end])) end--;
  const nameStart = end + 1;
  const patientName = tokens.slice(nameStart).join(' ');
  let description = tokens.slice(0, nameStart).join(' ').trim();
  description = stripTrailingProviderCode(description);
  if (!description) description = 'Unknown (Legacy)';
  return { patientName, description };
}

export function parseVaccineRecords(pdfText: string): VaccineDeliveryRow[] {
  const rows: VaccineDeliveryRow[] = [];
  const lines = pdfText.split('\n').map(l => l.trim()).filter(Boolean);
  console.log(JSON.stringify(lines[0], null, 2));
  let currentLot: VaccineLotMeta | null = null;
  let inTable = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    if (/^lot\s*#?\s*manufacturer/i.test(line)) {
      const meta = collectLotMeta(lines, lineIndex);
      currentLot = meta || (!currentLot ? { lotNumber: '', manufacturer: '', expiryDate: '' } : currentLot);
      inTable = false;
      continue;
    }

    if (isTableHeader(line)) {
      inTable = true;
      continue;
    }

    if (isTotalsRow(line)) {
      inTable = false;
      continue;
    }

    if (!inTable || !currentLot) continue;

    const dates = extractLeadingDates(line);
    if (!dates) {
      // Sometimes pdf-parse yields a dangling single date line; skip
      continue;
    }

    const { dateGiven, dateDue } = normalizeGivenAndDue(dates.first, dates.second);
    let tail = dates.rest;

    const clientInfo = findClientAtLineEnd(tail);
    if (!clientInfo) continue; // cannot parse without client
    const { clientFamilyName, clientGivenName, beforeClient } = clientInfo;

    const { withoutTag } = stripTrailingTagNumber(beforeClient);

    const { patientName, description } = extractPatientAndDescription(withoutTag);
    if (!patientName || !clientFamilyName || !clientGivenName) continue;

    rows.push({
      dateGiven,
      dateDue,
      patientName,
      clientGivenName,
      clientFamilyName,
      description,
      lotNumber: currentLot.lotNumber,
      manufacturer: currentLot.manufacturer,
      expiryDate: currentLot.expiryDate,
    });
  }

  return rows;
}

export function writeVaccineRowsToJSON(rows: VaccineDeliveryRow[], outputDir: string): string {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = `${outputDir}/vaccine-records_${timestamp}.json`;
  fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
  return filePath;
}

// =========================
// Structured parsing via pdf2json (optional)
// =========================
import type { Pdf2JsonDoc, Pdf2JsonPage, Pdf2JsonText } from '../clients/pdf2jsonClient.js';

function decodeText(t?: string): string {
  if (!t) return '';
  try { return decodeURIComponent(t); } catch { return t; }
}

function pageTexts(page: Pdf2JsonPage): Array<{ x: number; y: number; text: string }> {
  const out: Array<{ x: number; y: number; text: string }> = [];
  const items = page.Texts || [];
  for (const it of items) {
    const runs = it.R || [];
    const text = runs.map(r => decodeText(r.T)).join('');
    if (text.trim()) out.push({ x: it.x, y: it.y, text });
  }
  return out;
}

function groupByRow(texts: Array<{ x: number; y: number; text: string }>, tolerance = 0.6) {
  // Group items by Y value within a small tolerance so each row aggregates columns
  const rows: Array<{ y: number; cells: Array<{ x: number; text: string }> }> = [];
  for (const t of texts.sort((a, b) => a.y - b.y || a.x - b.x)) {
    let target = rows.find(r => Math.abs(r.y - t.y) <= tolerance);
    if (!target) {
      target = { y: t.y, cells: [] };
      rows.push(target);
    }
    target.cells.push({ x: t.x, text: t.text });
  }
  return rows;
}

function findOnRow(row: { y: number; cells: Array<{ x: number; text: string }> }, label: string) {
  const idx = row.cells.findIndex(c => c.text.toLowerCase() === label.toLowerCase());
  return idx >= 0 ? { index: idx, cell: row.cells[idx] } : null;
}

function textToRight(row: { cells: Array<{ x: number; text: string }> }, x: number) {
  const candidates = row.cells.filter(c => c.x > x + 0.1).sort((a, b) => a.x - b.x);
  return candidates.length > 0 ? candidates[0] : null;
}

function detectColumns(headerRow: { cells: Array<{ x: number; text: string }> }) {
  // Map known headers to X positions
  const getX = (label: string) => headerRow.cells.find(c => c.text.toLowerCase() === label.toLowerCase())?.x ?? -1;
  const cols = {
    dateGivenX: getX('Date Given'),
    dateDueX: getX('Date Due'),
    patientNameX: getX('Patient name'),
    tagX: getX('Tag #'),
    clientNameX: getX('Client name'),
    descriptionX: getX('Description'),
    providerX: getX('Provider'),
  };
  // Build ordered X list for boundaries
  const xs = Object.values(cols).filter(v => v >= 0).sort((a, b) => a - b);
  const bounds: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const left = xs[i];
    const right = i + 1 < xs.length ? xs[i + 1] : Number.POSITIVE_INFINITY;
    bounds.push((left + (i + 1 < xs.length ? right : left + 50)) / 2);
  }
  return { cols, xs, bounds };
}

function cellTextInRange(row: { cells: Array<{ x: number; text: string }> }, leftX: number, rightBound: number) {
  const parts = row.cells
    .filter(c => c.x >= leftX - 0.1 && c.x < rightBound)
    .sort((a, b) => a.x - b.x)
    .map(c => c.text);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function findTokenX(row: { cells: Array<{ x: number; text: string }> }, token: string): number | undefined {
  const m = row.cells
    .filter(c => c.text.toLowerCase() === token.toLowerCase())
    .map(c => c.x)
    .sort((a, b) => a - b);
  return m.length ? m[0] : undefined;
}

function rowHasTokens(row: { cells: Array<{ x: number; text: string }> }, tokens: string[]): boolean {
  const set = new Set(row.cells.map(c => c.text.toLowerCase()));
  return tokens.every(t => set.has(t.toLowerCase()));
}

export function parseVaccineRecordsStructured(doc: Pdf2JsonDoc): VaccineDeliveryRow[] {
  const rowsOut: VaccineDeliveryRow[] = [];
  const pages = doc.Pages || [];

  for (const page of pages) {
    const texts = pageTexts(page);
    const grouped = groupByRow(texts);

    let lotMeta: VaccineLotMeta | null = null;
    let inTable = false;
    let columns: { cols: Record<string, number>; xs: number[]; bounds: number[] } | null = null;

    for (let i = 0; i < grouped.length; i++) {
      const row = grouped[i];
      const rowTextJoined = row.cells.map(c => c.text).join(' ').toLowerCase();
      if (rowTextJoined.includes('lot') && rowTextJoined.includes('manufacturer')) {
        // New lot section — collect by positions between tokens
        const xLot = findTokenX(row, 'Lot') ?? findTokenX(row, 'Lot #') ?? 0;
        const xMan = findTokenX(row, 'Manufacturer') ?? 9999;
        const xExp = findTokenX(row, 'Expires');

        const lotNumber = cellTextInRange(row, xLot + 0.1, xMan) || '';
        const manufacturer = cellTextInRange(row, xMan + 0.1, xExp ?? Number.POSITIVE_INFINITY) || '';
        const expRaw = xExp !== undefined ? cellTextInRange(row, xExp + 0.1, Number.POSITIVE_INFINITY) : '';
        const expiryDate = normalizeMmDdYyyy(expRaw) || '';

        lotMeta = { lotNumber: lotNumber.trim(), manufacturer: manufacturer.trim(), expiryDate };
        inTable = false;
        columns = null;
        continue;
      }

      if (rowTextJoined.includes('date given') && rowTextJoined.includes('client name') && rowTextJoined.includes('description')) {
        // Header row
        columns = detectColumns(row);
        inTable = true;
        continue;
      }

      if (inTable && row.cells.some(c => /total number of vaccinations/i.test(c.text))) {
        inTable = false;
        continue;
      }

      if (!inTable || !lotMeta || !columns) continue;

      const { xs, bounds } = columns;
      if (xs.length === 0) continue;

      // For each known header, slice text in its range
      const getRangeText = (xLabel: number, index: number) => {
        const rightBound = bounds[index] ?? Number.POSITIVE_INFINITY;
        return cellTextInRange(row, xLabel, rightBound);
      };

      const dateGivenStr = columns.cols.dateGivenX >= 0 ? getRangeText(columns.cols.dateGivenX, xs.indexOf(columns.cols.dateGivenX)) : '';
      const dateDueStr = columns.cols.dateDueX >= 0 ? getRangeText(columns.cols.dateDueX, xs.indexOf(columns.cols.dateDueX)) : '';
      const patientStr = columns.cols.patientNameX >= 0 ? getRangeText(columns.cols.patientNameX, xs.indexOf(columns.cols.patientNameX)) : '';
      const clientStr = columns.cols.clientNameX >= 0 ? getRangeText(columns.cols.clientNameX, xs.indexOf(columns.cols.clientNameX)) : '';
      const descStr = columns.cols.descriptionX >= 0 ? getRangeText(columns.cols.descriptionX, xs.indexOf(columns.cols.descriptionX)) : '';
      // provider available but we ignore; tag is not needed

      const dateGiven = normalizeMmDdYyyy(dateGivenStr) || '';
      const dateDue = normalizeMmDdYyyy(dateDueStr) || '';
      if (!dateGiven) continue; // skip empty rows

      let clientFamilyName = '';
      let clientGivenName = '';
      if (clientStr.includes(',')) {
        const [family, given] = clientStr.split(',');
        clientFamilyName = family.trim();
        clientGivenName = (given || '').trim();
      } else {
        // fallback split on space
        const parts = clientStr.split(' ');
        clientFamilyName = parts.pop() || '';
        clientGivenName = parts.join(' ');
      }

      const rowOut: VaccineDeliveryRow = {
        dateGiven,
        dateDue: dateDue || undefined,
        patientName: patientStr.trim(),
        clientGivenName,
        clientFamilyName,
        description: descStr.trim(),
        lotNumber: lotMeta.lotNumber,
        manufacturer: lotMeta.manufacturer,
        expiryDate: lotMeta.expiryDate,
      };

      rowsOut.push(rowOut);
    }
  }

  return rowsOut;
}
