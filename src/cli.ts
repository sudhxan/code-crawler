#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadAllAuthorship } from './persistence.js';
import { generateCommitReport } from './reporter.js';
import { ForensicSupervisor, saveLedger } from './forensics/supervisor.js';
import { buildFingerprint, injectTrailer, extractTrailer, readFingerprintsFromLog } from './fingerprint.js';
import { installHooks, uninstallHooks, checkHooks } from './hook-installer.js';
import { analyzePull, formatPullAnalysis } from './pull-analyzer.js';
import type { ForensicReport, ForensicFileResult } from './forensics/types.js';

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
code-crawler - AI vs Human code detection

Commands:
  report [path]                Read .code-crawler/ data and display authorship stats
  status                       Show if tracking data exists
  forensic <commit>            Analyze a specific commit for AI-generated code
  forensic-diff <base> [head]  Analyze diff between two refs
  forensic-file <path>         Analyze a single file for AI-generated code
  forensic-branch <branch>     Analyze a branch against main
  analyze-pull [range]         Analyze pulled code (uses fingerprints + forensics)
  install-hooks                Install git hooks for automatic fingerprinting
  uninstall-hooks              Remove Code Crawler git hooks
  hook-status                  Check if git hooks are installed
  read-fingerprints [range]    Read fingerprints from commit history

Options:
  --json          Output results as JSON
  --help          Show this help message
`);
    process.exit(0);
  }

  const repoRoot = findRepoRoot('.') || process.cwd();

  if (command === 'report') {
    const target = args[1] || '.';
    const root = findRepoRoot(target) || path.resolve(target);
    const jsonOutput = args.includes('--json');

    const files = loadAllAuthorship(root);
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
    const dataDir = path.join(repoRoot, '.code-crawler', 'authorship');
    if (fs.existsSync(dataDir)) {
      const files = loadAllAuthorship(repoRoot);
      console.log(`Code Crawler: Tracking data found for ${files.length} file(s).`);
    } else {
      console.log('Code Crawler: No tracking data found.');
    }
    const hooks = checkHooks(repoRoot);
    console.log(`Git hooks: prepare-commit-msg=${hooks.prepareCommitMsg ? 'active' : 'not installed'}, post-merge=${hooks.postMerge ? 'active' : 'not installed'}`);

  } else if (command === 'forensic') {
    const commitRef = args[1];
    if (!commitRef) { console.error('Usage: code-crawler forensic <commit>'); process.exit(1); }
    const jsonOutput = args.includes('--json');
    const supervisor = new ForensicSupervisor(repoRoot);
    const report = supervisor.analyzeCommit(commitRef);
    saveLedger(repoRoot, report);
    if (jsonOutput) { console.log(JSON.stringify(report, null, 2)); }
    else { printForensicReport(report); }

  } else if (command === 'forensic-diff') {
    const base = args[1];
    if (!base) { console.error('Usage: code-crawler forensic-diff <base> [head]'); process.exit(1); }
    const jsonOutput = args.includes('--json');
    const supervisor = new ForensicSupervisor(repoRoot);
    const report = supervisor.analyzeDiff(base, args[2]);
    saveLedger(repoRoot, report);
    if (jsonOutput) { console.log(JSON.stringify(report, null, 2)); }
    else { printForensicReport(report); }

  } else if (command === 'forensic-file') {
    const filePath = args[1];
    if (!filePath) { console.error('Usage: code-crawler forensic-file <path>'); process.exit(1); }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      console.error(`File not found: ${resolved}`);
      process.exit(1);
    }
    const supervisor = new ForensicSupervisor(repoRoot);
    const jsonOutput = args.includes('--json');
    const result = supervisor.analyzeFile(resolved);
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printFileVerdict(result);
    }

  } else if (command === 'forensic-branch') {
    const branch = args[1];
    if (!branch) { console.error('Usage: code-crawler forensic-branch <branch>'); process.exit(1); }
    const supervisor = new ForensicSupervisor(repoRoot);
    const report = supervisor.analyzeBranch(branch);
    saveLedger(repoRoot, report);
    printForensicReport(report);

  // ── Hidden commands (called by git hooks, not by users) ──────────

  } else if (command === 'inject-fingerprint') {
    // Called by prepare-commit-msg hook: inject-fingerprint <msg-file> <repo-root> <staged-files...>
    const msgFile = args[1];
    const hookRepoRoot = args[2];
    const stagedFiles = args.slice(3);
    if (!msgFile || !hookRepoRoot || stagedFiles.length === 0) process.exit(0);

    try {
      const fp = buildFingerprint(hookRepoRoot, stagedFiles);
      if (fp.files.length === 0) process.exit(0); // No tracked files, skip silently

      const originalMsg = fs.readFileSync(msgFile, 'utf-8');
      const injected = injectTrailer(originalMsg, fp);
      fs.writeFileSync(msgFile, injected);
    } catch {
      // Silent failure — never break the commit
    }
    process.exit(0);

  } else if (command === 'analyze-pull') {
    // Called by post-merge hook: analyze-pull <repo-root> <range>
    const pullRepoRoot = args[1] || repoRoot;
    const range = args[2] || 'ORIG_HEAD..HEAD';

    const result = analyzePull(pullRepoRoot, range);
    // Save results to .code-crawler/forensics/pulls/
    const pullsDir = path.join(pullRepoRoot, '.code-crawler', 'forensics', 'pulls');
    fs.mkdirSync(pullsDir, { recursive: true });
    const pullFile = path.join(pullsDir, `${Date.now()}.json`);
    fs.writeFileSync(pullFile, JSON.stringify(result, null, 2));

    // Also print to stdout (visible in terminal if run manually)
    console.log('\n' + formatPullAnalysis(result) + '\n');

  // ── User-facing hook management commands ─────────────────────────

  } else if (command === 'install-hooks') {
    const result = installHooks(repoRoot);
    if (result.installed.length > 0) {
      console.log(`Installed hooks: ${result.installed.join(', ')}`);
    }
    if (result.skipped.length > 0) {
      console.log(`Skipped: ${result.skipped.join(', ')}`);
    }
    console.log('Code Crawler will now silently fingerprint your commits.');

  } else if (command === 'uninstall-hooks') {
    const removed = uninstallHooks(repoRoot);
    if (removed.length > 0) {
      console.log(`Removed hooks: ${removed.join(', ')}`);
    } else {
      console.log('No Code Crawler hooks found.');
    }

  } else if (command === 'hook-status') {
    const hooks = checkHooks(repoRoot);
    console.log(`prepare-commit-msg: ${hooks.prepareCommitMsg ? 'installed' : 'not installed'}`);
    console.log(`post-merge: ${hooks.postMerge ? 'installed' : 'not installed'}`);

  } else if (command === 'read-fingerprints') {
    const range = args[1] || 'HEAD~10..HEAD';
    const fps = readFingerprintsFromLog(repoRoot, range);
    if (fps.length === 0) {
      console.log('No Code Crawler fingerprints found in commit history.');
      console.log('The other developer may not have Code Crawler installed.');
    } else {
      console.log(`\nFound ${fps.length} fingerprinted commit(s):\n`);
      for (const { commitHash, fingerprint } of fps) {
        console.log(`Commit: ${commitHash.substring(0, 8)}`);
        for (const f of fingerprint.files) {
          console.log(`  ${f.f}: ${f.a}% AI | ${f.h}% Human (${f.l} lines, confidence: ${f.c}%, signal: ${f.s})`);
        }
        console.log('');
      }
    }

  } else {
    console.error(`Unknown command: ${command}. Use --help for usage.`);
    process.exit(1);
  }
}

function printForensicReport(report: ForensicReport): void {
  console.log('\n=== Forensic Analysis Report ===\n');

  for (const file of report.files) {
    const dots = '.'.repeat(Math.max(2, 50 - file.filePath.length));
    console.log(`${file.filePath} ${dots} ${file.aiPercentage}% AI | ${file.humanPercentage}% Human (confidence: ${file.confidence.toFixed(2)})`);

    if (file.signals.length > 0) {
      const top = file.signals
        .filter(s => Math.abs(s.score - 0.5) > 0.05)
        .sort((a, b) => Math.abs(b.score - 0.5) - Math.abs(a.score - 0.5))
        .slice(0, 4);
      if (top.length > 0) {
        const signalStr = top.map(s => `${s.name}(${s.score.toFixed(2)})`).join(', ');
        console.log(`  Signals: ${signalStr}`);
      }
    }
  }

  const o = report.overall;
  console.log(`\nOverall: ${o.aiPercentage}% AI | ${o.humanPercentage}% Human (${o.totalLinesAnalyzed} lines analyzed)`);
  if (report.sourceRef) console.log(`Source: ${report.sourceRef}`);
  console.log('');
}

function printFileVerdict(result: ForensicFileResult): void {
  console.log('\n=== Forensic File Analysis ===\n');
  console.log(`File: ${result.filePath}`);
  console.log(`Verdict: ${result.overallVerdict.toUpperCase()}`);
  console.log(`Result: ${result.aiPercentage}% AI | ${result.humanPercentage}% Human (confidence: ${result.confidence.toFixed(2)})`);

  if (result.signals.length > 0) {
    console.log('\nSignals:');
    for (const s of result.signals) {
      const dir = s.score > 0.6 ? 'AI' : s.score < 0.4 ? 'Human' : 'Neutral';
      console.log(`  ${s.name}: ${s.score.toFixed(2)} [${dir}] (confidence: ${s.confidence.toFixed(2)})`);
      for (const e of s.evidence) {
        console.log(`    - ${e}`);
      }
    }
  }

  const aiLines = result.lineVerdicts.filter(v => v.verdict === 'ai').length;
  const humanLines = result.lineVerdicts.filter(v => v.verdict === 'human').length;
  const uncertainLines = result.lineVerdicts.filter(v => v.verdict === 'uncertain').length;
  console.log(`\nLine breakdown: ${aiLines} AI | ${humanLines} Human | ${uncertainLines} Uncertain (${result.lineVerdicts.length} total)`);
  console.log('');
}

main();
