#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Read package.json
const packagePath = join(projectRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

// Get all command files
const commandsDir = join(projectRoot, 'src', 'commands');
const commandFiles = readdirSync(commandsDir).filter(file => file.endsWith('.ts'));

// Generate scripts for each command
const newScripts = { ...packageJson.scripts };

for (const file of commandFiles) {
  const commandName = basename(file, '.ts');
  const scriptCommand = `tsx src/commands/${file}`;
  
  // Only add if it doesn't already exist
  if (!newScripts[commandName]) {
    newScripts[commandName] = scriptCommand;
    console.log(`Added command: npm run ${commandName}`);
  }
}

// Update package.json
packageJson.scripts = newScripts;
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');

console.log('✅ Commands synchronized with package.json');
console.log('\nAvailable commands:');
commandFiles.forEach(file => {
  const commandName = basename(file, '.ts');
  console.log(`  npm run ${commandName}`);
});