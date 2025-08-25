#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get command name from process arguments
const commandName = process.argv[2];
if (!commandName) {
  console.error('Usage: npm run <command-name> [args...]');
  process.exit(1);
}

// Build path to command file
const projectRoot = join(__dirname, '..');
const commandPath = join(projectRoot, 'src', 'commands', `${commandName}.ts`);

// Check if command exists
if (!existsSync(commandPath)) {
  console.error(`Command not found: ${commandName}`);
  console.error(`Looking for: ${commandPath}`);
  process.exit(1);
}

// Get remaining arguments to pass to the command
const commandArgs = process.argv.slice(3);

// Execute the command using tsx
const child = spawn('npx', ['tsx', commandPath, ...commandArgs], {
  stdio: 'inherit',
  cwd: projectRoot
});

child.on('error', (error) => {
  console.error(`Failed to start command: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code || 0);
});