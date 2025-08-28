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
