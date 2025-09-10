import { ClientImportRow, ClientInput, PatientInput, AddressInput, PhoneNumberInput, Sex } from '../types';
import { ImmunizationDraft, ImmunizationStatus, ImmunizationType, RouteType } from '../types';
import { VaccineDeliveryRow, normalizeMmDdYyyy } from './pdfParser.js';

/**
 * Check if field contains actual data (not empty, placeholder, or corrupted)
 */
function hasValue(value: string | null, fieldName?: string): boolean {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;

    // Handle placeholder values like "clientEmail", "patientColor", etc.
    if (fieldName && trimmed === fieldName) return false;

    // Handle corrupted data like breed names in sex field (Mini", Standard", toy")
    if (trimmed.includes('"')) return false;

    return true;
}

/**
 * Parse weight - all weights are simple decimal numbers in pounds
 */
export function parseWeight(weightStr: string | null): number | undefined {
    if (!hasValue(weightStr, 'patientWeight')) return undefined;
    const weight = parseFloat(weightStr!);
    return isNaN(weight) ? undefined : weight;
}

/**
 * Parse date from MM/DD/YYYY format - some fields have color data instead
 */
export function parseDate(dateStr: string | null): string | undefined {
    if (!hasValue(dateStr, 'patientDOB')) return undefined;

    // Skip if it looks like a color name instead of a date
    if (!/\d/.test(dateStr!)) return undefined;

    try {
        const date = new Date(dateStr!);
        return isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
    } catch {
        return undefined;
    }
}

/**
 * Parse sex and neutered status from the dataset codes
 */
export function parseSexAndNeutered(patientSexSpay: string | null): { sex: Sex; neutered: boolean } {
    // Sex/spay lookup - covers MI, MN, FI, FS from the data
    const SEX_SPAY_LOOKUP: Record<string, { sex: Sex, neutered: boolean }> = {
        'MI': { sex: 'MALE', neutered: false }, // Male Intact (155 records)
        'MN': { sex: 'MALE', neutered: true },  // Male Neutered (1050 records)  
        'FI': { sex: 'FEMALE', neutered: false }, // Female Intact (138 records)
        'FS': { sex: 'FEMALE', neutered: true },  // Female Spayed (1018 records)
    } as const;

    if (!hasValue(patientSexSpay)) {
        return { sex: 'UNKNOWN', neutered: false };
    }

    const code = patientSexSpay!.trim().toUpperCase();
    return SEX_SPAY_LOOKUP[code as keyof typeof SEX_SPAY_LOOKUP] || { sex: 'UNKNOWN', neutered: false };
}

/**
 * Check if patient is deceased - 'D' and 'ND' statuses indicate deceased
 */
export function isPatientDeceased(patientStatus: string | null): boolean {
    // Patient status codes from the data: H=1377, ND=206, NA=73, D=3
    // ND = Not Dead/Deceased, D = Deceased
    const DECEASED_STATUSES = new Set(['D', 'ND']);

    if (!patientStatus) return false;
    return DECEASED_STATUSES.has(patientStatus.trim());
}

/**
 * Build address from available fields using table-driven approach
 */
function buildAddress(row: ClientImportRow): AddressInput | undefined {
    // Address field mappings
    const ADDRESS_FIELDS = [
        { from: 'clientStreetAddr' as keyof ClientImportRow, to: 'line1' as keyof AddressInput },
        { from: 'clientCity' as keyof ClientImportRow, to: 'city' as keyof AddressInput },
        { from: 'clientState' as keyof ClientImportRow, to: 'state' as keyof AddressInput },
        { from: 'clientPostCode' as keyof ClientImportRow, to: 'postalCode' as keyof AddressInput },
    ] as const;

    const address: Partial<AddressInput> = {};
    let hasData = false;

    for (const field of ADDRESS_FIELDS) {
        if (hasValue(row[field.from], field.from)) {
            address[field.to] = row[field.from]!;
            hasData = true;
        }
    }

    return hasData ? address as AddressInput : undefined;
}


// Metadata type for transformation results
export interface TransformationMetadata {
    hasAnyAddress: boolean;
    hasPhoneNumber: boolean;
    hasPatientWeight: boolean;
    hasPatientDOB: boolean;
    patientStatus: string | null;
    patientIsDeceased: boolean;
}

/**
 * Unified transformation where client active status depends on patient deceased status
 */
export function transformInputRow(row: ClientImportRow): {
    client: ClientInput;
    patient: PatientInput;
    metadata: TransformationMetadata;
} {
    // Client field mappings
    const CLIENT_FIELDS = [
        { from: 'clientFirstName' as keyof ClientImportRow, to: 'givenName' as keyof ClientInput },
        { from: 'clientLastName' as keyof ClientImportRow, to: 'familyName' as keyof ClientInput },
        { from: 'clientEmail' as keyof ClientImportRow, to: 'email' as keyof ClientInput },
    ] as const;

    // Patient field mappings
    const PATIENT_FIELDS = [
        { from: 'patientName' as keyof ClientImportRow, to: 'name' as keyof PatientInput },
        { from: 'patientSpecies' as keyof ClientImportRow, to: 'species' as keyof PatientInput },
        { from: 'patientBreed' as keyof ClientImportRow, to: 'breed' as keyof PatientInput },
        { from: 'patientColor' as keyof ClientImportRow, to: 'color' as keyof PatientInput },
    ] as const;

    // Build patient first to determine deceased status
    const patientData: Partial<PatientInput> = {};
    for (const field of PATIENT_FIELDS) {
        if (hasValue(row[field.from], field.from)) {
            // @ts-ignore compiler dumb
            patientData[field.to] = row[field.from]!;
        }
    }

    const { sex, neutered } = parseSexAndNeutered(row.patientSexSpay);
    const birthDate = parseDate(row.patientDOB);
    const isDeceased = isPatientDeceased(row.patientStatus);

    const patient: PatientInput = {
        name: patientData.name || '',
        species: patientData.species || '',
        breed: patientData.breed || '',
        color: patientData.color,
        sex,
        neutered,
        birthDate,
        isDeceased,
        isEstimatedAge: !birthDate,
        isEstimatedWeight: !!row.patientWeight,
        isActive: !isDeceased,
        historicalId: hasValue(row.patientId) ? row.patientId! : undefined,
    };
    if (row.patientWeight) patient.goalWeight = row.patientWeight;

    // Build client with status depending on patient
    const clientData: Partial<ClientInput> = {};
    for (const field of CLIENT_FIELDS) {
        if (hasValue(row[field.from], field.from)) {
            // @ts-ignore compiler dumb
            clientData[field.to] = row[field.from]!;
        }
    }

    const addresses: AddressInput[] = [];
    const address = buildAddress(row);
    if (address) {
        addresses.push(address);
    }

    const phoneNumbers: PhoneNumberInput[] = [];
    if (hasValue(row.clientPhone, 'clientPhone')) {
        phoneNumbers.push({ value: row.clientPhone! });
    }

    const client: ClientInput = {
        givenName: clientData.givenName || '',
        familyName: clientData.familyName || '',
        email: clientData.email || '',
        addresses,
        phoneNumbers,
        notes: 'Imported from legacy system',
        isActive: !isDeceased, // Client inactive if their pet is deceased
        historicalId: hasValue(row.clientId) ? `${row.clientId!}<primary-location-change-from:27830>` : undefined,
    };

    const metadata: TransformationMetadata = {
        hasAnyAddress: (client.addresses?.length || 0) > 0,
        hasPhoneNumber: hasValue(row.clientPhone, 'clientPhone'),
        hasPatientWeight: hasValue(row.patientWeight, 'patientWeight'),
        hasPatientDOB: hasValue(row.patientDOB, 'patientDOB'),
        patientStatus: row.patientStatus,
        patientIsDeceased: isDeceased,
    };

    return { client, patient, metadata };
}

// ============================
// Immunization transformation
// ============================

export function isFutureDate(dateLike?: string): boolean {
    if (!dateLike) return false;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(dateLike) ? dateLike : (normalizeMmDdYyyy(dateLike) ?? '');
    if (!iso) return false;
    const todayIso = new Date().toISOString().slice(0, 10);
    return iso > todayIso;
}

const boosterPatterns: RegExp[] = [
    /#\s*2\b/i,
    /#\s*3\b/i,
    /\b2nd\b/i,
    /\b3rd\b/i,
];

export function detectImmunizationType(description: string): ImmunizationType {
    for (const pat of boosterPatterns) {
        if (pat.test(description)) return 'BOOSTER';
    }
    return 'INITIAL';
}

export function detectRoute(description: string): RouteType {
    return /intranasal/i.test(description) ? 'INTRANASAL' : 'SUBCUTANEOUS';
}

export function detectRabies(description: string): boolean {
    return /rabies/i.test(description);
}

export function toImmunizationDraft(row: VaccineDeliveryRow, patientId: string): ImmunizationDraft {
    const status: ImmunizationStatus = isFutureDate(row.dateDue) ? 'ACTIVE' : 'COMPLETED';

    return {
        administered: true,
        date: row.dateGiven,
        dueDate: row.dateDue,
        declined: false,
        expiryDate: row.expiryDate,
        historical: true,
        immunizationStatus: status,
        isRabies: detectRabies(row.description),
        lotNumber: row.lotNumber,
        manufacturer: row.manufacturer,
        name: row.description,
        patient: patientId,
        route: detectRoute(row.description),
        site: 'Unknown (Legacy)',
        type: detectImmunizationType(row.description),
    };
}
