#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeCode } from './analyzer/index.js';
import type { AnalysisResult } from './analyzer/index.js';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go',
  '.rs', '.java', '.c', '.cpp', '.cs', '.php', '.swift',
]);

function collectFiles(target: string): string[] {
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];

  const files: string[] = [];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (CODE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function formatTable(results: AnalysisResult[]): string {
  const header = `${'File'.padEnd(50)} ${'AI %'.padStart(6)} ${'Human %'.padStart(8)} ${'Confidence'.padStart(11)}`;
  const separator = '-'.repeat(header.length);

  const rows = results.map(r => {
    const name = r.filePath.length > 48 ? '...' + r.filePath.slice(-45) : r.filePath;
    return `${name.padEnd(50)} ${(r.summary.aiPercentage + '%').padStart(6)} ${(r.summary.humanPercentage + '%').padStart(8)} ${(Math.round(r.summary.confidence * 100) + '%').padStart(11)}`;
  });

  return [separator, header, separator, ...rows, separator].join('\n');
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
code-crawler - Detect AI-written vs human-written code

Usage: code-crawler <file-or-directory> [options]

Options:
  --json    Output results as JSON
  --help    Show this help message
`);
    process.exit(0);
  }

  const jsonOutput = args.includes('--json');
  const targets = args.filter(a => !a.startsWith('--'));

  const allResults: AnalysisResult[] = [];

  for (const target of targets) {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: ${target} not found`);
      process.exit(1);
    }

    const files = collectFiles(resolved);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      allResults.push(analyzeCode(content, file));
    }
  }

  if (allResults.length === 0) {
    console.log('No code files found.');
    process.exit(0);
  }

  if (jsonOutput) {
    console.log(JSON.stringify(allResults, null, 2));
  } else {
    console.log('\ncode-crawler Analysis Results\n');
    console.log(formatTable(allResults));

    const totalAi = allResults.reduce((s, r) => s + r.summary.aiPercentage, 0) / allResults.length;
    console.log(`\nOverall: ~${Math.round(totalAi)}% likely AI-generated across ${allResults.length} file(s)\n`);
  }
}

main();
