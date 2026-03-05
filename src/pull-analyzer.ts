import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { readFingerprintsFromLog, type CommitFingerprint, type FileFingerprint } from './fingerprint.js';
import { ForensicSupervisor } from './forensics/supervisor.js';
import type { ForensicReport } from './forensics/types.js';

export interface PullAnalysisResult {
  /** How the analysis was done */
  method: 'fingerprint' | 'forensic' | 'hybrid';
  /** Per-file results */
  files: PullFileResult[];
  /** Overall stats */
  overall: {
    aiPercentage: number;
    humanPercentage: number;
    totalLines: number;
    confidence: number;
  };
  /** The commit range analyzed */
  commitRange: string;
  /** Number of commits with fingerprints vs total */
  fingerprintCoverage: {
    withFingerprint: number;
    total: number;
  };
}

export interface PullFileResult {
  filePath: string;
  aiPercentage: number;
  humanPercentage: number;
  lines: number;
  confidence: number;
  /** Where did this result come from */
  source: 'fingerprint' | 'forensic';
  /** Top signal that drove the classification */
  topSignal: string;
}

/**
 * Analyze code that was pulled/merged into the current branch.
 * Uses fingerprints from the other developer's Code Crawler if available,
 * otherwise falls back to forensic static analysis.
 */
export function analyzePull(repoRoot: string, commitRange: string): PullAnalysisResult {
  // 1. Try to read fingerprints from incoming commits
  const fingerprints = readFingerprintsFromLog(repoRoot, commitRange);

  // 2. Get all files changed in this range
  let changedFiles: string[] = [];
  try {
    changedFiles = execSync(
      `git diff --name-only ${commitRange}`,
      { cwd: repoRoot, encoding: 'utf-8' }
    ).trim().split('\n').filter(f => f.length > 0);
  } catch {
    changedFiles = [];
  }

  // Count total commits in range
  let totalCommits = 0;
  try {
    totalCommits = parseInt(
      execSync(`git rev-list --count ${commitRange}`, { cwd: repoRoot, encoding: 'utf-8' }).trim(),
      10
    );
  } catch {
    totalCommits = fingerprints.length;
  }

  const fileResults: PullFileResult[] = [];
  const filesWithFingerprints = new Set<string>();

  // 3. Process fingerprint data first (real behavioral data — highest trust)
  if (fingerprints.length > 0) {
    // Aggregate fingerprints across commits for each file
    // (a file may appear in multiple commits — use the latest)
    const latestByFile = new Map<string, FileFingerprint>();
    for (const { fingerprint } of fingerprints) {
      for (const file of fingerprint.files) {
        latestByFile.set(file.f, file);
      }
    }

    for (const [filePath, fp] of latestByFile) {
      filesWithFingerprints.add(filePath);
      fileResults.push({
        filePath,
        aiPercentage: fp.a,
        humanPercentage: fp.h,
        lines: fp.l,
        confidence: fp.c / 100,
        source: 'fingerprint',
        topSignal: fp.s,
      });
    }
  }

  // 4. Forensic fallback for files without fingerprints
  const filesWithoutFingerprints = changedFiles.filter(f => !filesWithFingerprints.has(f));
  if (filesWithoutFingerprints.length > 0) {
    const supervisor = new ForensicSupervisor(repoRoot);
    for (const file of filesWithoutFingerprints) {
      try {
        const result = supervisor.analyzeFile(file);
        // Find top signal
        let topSignal = 'none';
        let maxDev = 0;
        for (const s of result.signals) {
          const dev = Math.abs(s.score - 0.5);
          if (dev > maxDev) { maxDev = dev; topSignal = s.name; }
        }

        fileResults.push({
          filePath: file,
          aiPercentage: result.aiPercentage,
          humanPercentage: result.humanPercentage,
          lines: result.lineVerdicts.length,
          confidence: result.confidence,
          source: 'forensic',
          topSignal,
        });
      } catch {
        // File might not exist on disk (deleted in the diff)
      }
    }
  }

  // 5. Compute overall stats
  const totalLines = fileResults.reduce((s, f) => s + f.lines, 0);
  const weightedAi = fileResults.reduce((s, f) => s + f.aiPercentage * f.lines, 0);
  const weightedHuman = fileResults.reduce((s, f) => s + f.humanPercentage * f.lines, 0);
  const avgConfidence = fileResults.length > 0
    ? fileResults.reduce((s, f) => s + f.confidence, 0) / fileResults.length
    : 0;

  // Determine method used
  const hasFingerprints = filesWithFingerprints.size > 0;
  const hasForensic = filesWithoutFingerprints.length > 0;
  const method: PullAnalysisResult['method'] =
    hasFingerprints && hasForensic ? 'hybrid' :
    hasFingerprints ? 'fingerprint' : 'forensic';

  return {
    method,
    files: fileResults,
    overall: {
      aiPercentage: totalLines > 0 ? Math.round(weightedAi / totalLines) : 0,
      humanPercentage: totalLines > 0 ? Math.round(weightedHuman / totalLines) : 0,
      totalLines,
      confidence: avgConfidence,
    },
    commitRange,
    fingerprintCoverage: {
      withFingerprint: fingerprints.length,
      total: totalCommits,
    },
  };
}

/**
 * Format a pull analysis result for CLI output.
 */
export function formatPullAnalysis(result: PullAnalysisResult): string {
  const lines: string[] = [];

  const methodLabel = {
    fingerprint: 'Behavioral data (Code Crawler fingerprints)',
    forensic: 'Static forensic analysis (no fingerprints found)',
    hybrid: 'Hybrid (fingerprints + forensic fallback)',
  }[result.method];

  lines.push('=== Pull Analysis Report ===');
  lines.push(`Method: ${methodLabel}`);
  lines.push(`Fingerprint coverage: ${result.fingerprintCoverage.withFingerprint}/${result.fingerprintCoverage.total} commits`);
  lines.push('');

  for (const file of result.files) {
    const dots = '.'.repeat(Math.max(2, 50 - file.filePath.length));
    const badge = file.source === 'fingerprint' ? '[FP]' : '[FA]';
    lines.push(`${file.filePath} ${dots} ${file.aiPercentage}% AI | ${file.humanPercentage}% Human ${badge} (${file.topSignal})`);
  }

  lines.push('');
  lines.push(`Overall: ${result.overall.aiPercentage}% AI | ${result.overall.humanPercentage}% Human (${result.overall.totalLines} lines)`);
  lines.push(`Confidence: ${(result.overall.confidence * 100).toFixed(0)}%`);

  return lines.join('\n');
}
