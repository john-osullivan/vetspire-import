import { describe, it, expect } from 'vitest';
import { updateImportedPrimaryLocations } from '../services/importer.js';

describe('update-import integration (dry run)', () => {
  it('runs in dry-run mode and returns a result object', async () => {
    const result = await updateImportedPrimaryLocations({ sendApiRequests: false, useRealLocation: false, verbose: false });
    expect(result).toBeDefined();
    // result should include numeric updated property
    expect(typeof (result as any).updated).toBe('number');
  });
});
