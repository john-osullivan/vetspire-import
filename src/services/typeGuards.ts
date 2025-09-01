export function isRecord(x: unknown): x is Record<string, unknown> {
    return typeof x === 'object' && x !== null;
}

export function getString(r: Record<string, unknown>, key: string): string | undefined {
    const v = r[key];
    return typeof v === 'string' ? v : undefined;
}

export function getNotes(obj: unknown): string {
    if (!isRecord(obj)) return '';
    const r = obj as Record<string, unknown>;
    return getString(r, 'notes') || getString(r, 'privateNotes') || '';
}

export function isClient(obj: unknown): obj is import('../types/apiTypes.js').Client {
    if (!isRecord(obj)) return false;
    const r = obj as Record<string, unknown>;
    return typeof r.id === 'string' &&
        typeof r.givenName === 'string' &&
        typeof r.familyName === 'string';
}

export function isPatient(obj: unknown): obj is import('../types/apiTypes.js').Patient {
    if (!isRecord(obj)) return false;
    const r = obj as Record<string, unknown>;
    return typeof r.id === 'string' &&
        (r.name === undefined || typeof r.name === 'string') &&
        (r.species === undefined || typeof r.species === 'string');
}
