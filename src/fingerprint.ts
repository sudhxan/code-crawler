import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { loadAllAuthorship } from './persistence.js';
import type { FileAuthorship } from './types.js';

/**
 * Compact per-file authorship summary for embedding in commits.
 * Designed to be as small as possible for commit trailers.
 */
interface FileFingerprint {
  /** relative file path */
  f: string;
  /** AI percentage 0-100 */
  a: number;
  /** Human percentage 0-100 */
  h: number;
  /** Total lines tracked */
  l: number;
  /** Average confidence 0-100 (scaled from 0-1) */
  c: number;
  /** Top signal name that drove the classification */
  s: string;
}

interface CommitFingerprint {
  /** version of the fingerprint format */
  v: number;
  /** timestamp */
  t: number;
  /** per-file fingerprints */
  files: FileFingerprint[];
}

/**
 * Build a fingerprint from current authorship data for files that are staged for commit.
 */
export function buildFingerprint(repoRoot: string, stagedFiles: string[]): CommitFingerprint {
  const allAuthorship = loadAllAuthorship(repoRoot);
  const fingerprints: FileFingerprint[] = [];

  for (const staged of stagedFiles) {
    // Find authorship data for this file
    const authorship = allAuthorship.find(a => a.filePath === staged);
    if (!authorship || authorship.lines.length === 0) continue;

    // Find dominant signal
    let topSignal = '';
    let maxDev = 0;
    for (const line of authorship.lines) {
      if (!line.signals) continue;
      for (const [key, val] of Object.entries(line.signals)) {
        const dev = Math.abs(val - 0.5);
        if (dev > maxDev) { maxDev = dev; topSignal = key; }
      }
    }

    // Average confidence
    const avgConf = authorship.lines.length > 0
      ? authorship.lines.reduce((sum, l) => sum + l.confidence, 0) / authorship.lines.length
      : 0;

    fingerprints.push({
      f: staged,
      a: authorship.summary.aiPercentage,
      h: authorship.summary.humanPercentage,
      l: authorship.summary.totalLines,
      c: Math.round(avgConf * 100),
      s: topSignal || 'none',
    });
  }

  return {
    v: 1,
    t: Date.now(),
    files: fingerprints,
  };
}

/**
 * Encode a fingerprint to a compact base64 string for embedding in commit trailers.
 */
export function encodeFingerprint(fp: CommitFingerprint): string {
  const json = JSON.stringify(fp);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode a fingerprint from a base64 commit trailer value.
 */
export function decodeFingerprint(encoded: string): CommitFingerprint | null {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (parsed && parsed.v && Array.isArray(parsed.files)) {
      return parsed as CommitFingerprint;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Inject fingerprint trailer into a commit message.
 * Adds: "Code-Crawler-Data: <base64>" at the end.
 * If the trailer already exists, replaces it.
 */
export function injectTrailer(commitMessage: string, fingerprint: CommitFingerprint): string {
  const encoded = encodeFingerprint(fingerprint);
  const trailer = `Code-Crawler-Data: ${encoded}`;

  // Remove existing trailer if present
  const cleaned = commitMessage.replace(/\nCode-Crawler-Data: .+$/m, '');

  // Ensure there's a blank line before trailers (git convention)
  const trimmed = cleaned.trimEnd();
  return `${trimmed}\n\n${trailer}\n`;
}

/**
 * Extract fingerprint from a commit message, if present.
 */
export function extractTrailer(commitMessage: string): CommitFingerprint | null {
  const match = commitMessage.match(/^Code-Crawler-Data:\s*(.+)$/m);
  if (!match) return null;
  return decodeFingerprint(match[1].trim());
}

/**
 * Read fingerprints from git log for a range of commits.
 * Returns an array of { commitHash, fingerprint } objects.
 */
export function readFingerprintsFromLog(
  repoRoot: string,
  range: string = 'HEAD~10..HEAD',
): Array<{ commitHash: string; fingerprint: CommitFingerprint }> {
  const results: Array<{ commitHash: string; fingerprint: CommitFingerprint }> = [];

  try {
    // Get commit hashes and full messages
    const log = execSync(
      `git log --format="%H%n%B%n---END---" ${range} 2>/dev/null`,
      { cwd: repoRoot, encoding: 'utf-8' }
    );

    const commits = log.split('---END---').filter((s: string) => s.trim());
    for (const block of commits) {
      const lines = block.trim().split('\n');
      if (lines.length === 0) continue;
      const hash = lines[0].trim();
      const message = lines.slice(1).join('\n');
      const fp = extractTrailer(message);
      if (fp) {
        results.push({ commitHash: hash, fingerprint: fp });
      }
    }
  } catch {
    // git log failed, return empty
  }

  return results;
}

export type { CommitFingerprint, FileFingerprint };
