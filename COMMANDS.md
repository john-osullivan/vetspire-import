# Commands

This project automatically synchronizes commands from `/src/commands` with npm scripts. Any new `.ts` file added to the commands directory will automatically be available as `npm run <filename>`.

## Available Commands

### `npm run convert-pdf`
Convert PDF files to CSV format for import processing.

```bash
npm run convert-pdf path/to/file.pdf
npm run convert-pdf path/to/file.pdf --output ./custom-output-dir
```

### `npm run import-csv`
Import CSV records to the Vetspire API.

```bash
# Dry run (default - shows what would be sent)
npm run import-csv data.csv

# Actually send to API
npm run import-csv data.csv --full-send

# Test with limited records
npm run import-csv data.csv --limit 10

# Full send with limit
npm run import-csv data.csv --full-send --limit 5
```

**Features:**
- **Dry run mode by default** - shows exactly what API calls would be made
- **Full send mode** with `--full-send` flag for actual API calls
- **Limit option** for testing with subset of records
- **Comprehensive logging** showing client/patient status (active/deceased/inactive)
- **Smart client status** - clients are marked inactive if their pet is deceased
- **Import statistics** with summary of processed records

### `npm run rollback-import`
Rollback a previous import (if implemented).

```bash
npm run rollback-import <import-id>
```

## Adding New Commands

1. Create a new `.ts` file in `/src/commands/`
2. Follow the existing pattern using `yargs` for argument parsing
3. Add the shebang line: `#!/usr/bin/env node`
4. Run `npm run sync-commands` to update package.json
5. The command will be available as `npm run <filename>`

## Command Development Pattern

```typescript
#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command(
      '$0 <required-arg>',
      'Description of what this command does',
      (yargs) => {
        return yargs.positional('required-arg', {
          describe: 'Description of required argument',
          type: 'string',
          demandOption: true
        });
      }
    )
    .option('optional-flag', {
      alias: 'o',
      type: 'boolean',
      description: 'Optional flag description',
      default: false
    })
    .help()
    .example('$0 example-arg', 'Example usage')
    .argv;

  try {
    // Command implementation here
    console.log('Command executed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
```

## Automatic Synchronization

The project uses a `postinstall` hook to automatically sync commands:
- `npm install` automatically runs `npm run sync-commands`
- `npm run sync-commands` scans `/src/commands/` and adds missing scripts to package.json
- Commands are added as `"command-name": "tsx src/commands/command-name.ts"`

This ensures that all developers have access to the same commands without manual package.json updates.