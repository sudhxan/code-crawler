#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadAllAuthorship } from './persistence.js';
import { generateCommitReport } from './reporter.js';

function findRepoRoot(from: string): string | null {
  let dir = path.resolve(from);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
code-crawler - Keystroke-level AI code detection

Commands:
  report [path]   Read .code-crawler/ data and display authorship stats
  status          Show if tracking data exists

Options:
  --json          Output results as JSON
  --help          Show this help message
`);
    process.exit(0);
  }

  if (command === 'report') {
    const target = args[1] || '.';
    const repoRoot = findRepoRoot(target) || path.resolve(target);
    const jsonOutput = args.includes('--json');

    const files = loadAllAuthorship(repoRoot);
    if (files.length === 0) {
      console.log('No authorship data found. Install the VS Code extension to start tracking.');
      process.exit(0);
    }

    if (jsonOutput) {
      console.log(JSON.stringify(files, null, 2));
    } else {
      console.log('\n' + generateCommitReport(files) + '\n');
    }
  } else if (command === 'status') {
    const repoRoot = findRepoRoot('.') || process.cwd();
    const dataDir = path.join(repoRoot, '.code-crawler', 'authorship');
    if (fs.existsSync(dataDir)) {
      const files = loadAllAuthorship(repoRoot);
      console.log(`Code Crawler: Tracking data found for ${files.length} file(s).`);
    } else {
      console.log('Code Crawler: No tracking data found. Install the VS Code extension to start tracking.');
    }
  } else {
    console.error(`Unknown command: ${command}. Use --help for usage.`);
    process.exit(1);
  }
}

main();
