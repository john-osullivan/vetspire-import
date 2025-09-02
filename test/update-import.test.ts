import { describe, it, expect } from 'vitest';
import { updateImportedPrimaryLocations } from '../src/services/importer.js';

describe('update-import integration (dry run)', () => {
  it('runs in dry-run mode and returns a result object', async () => {
    const result = await updateImportedPrimaryLocations({ sendApiRequests: false, verbose: false });
    expect(result).toBeDefined();
    const asRecord = result as Record<string, unknown>;
    expect(typeof asRecord.updatedClients === 'number' || typeof asRecord.updatedClients === 'undefined').toBe(true);
    expect(typeof asRecord.updatedPatients === 'number' || typeof asRecord.updatedPatients === 'undefined').toBe(true);
  });
});
