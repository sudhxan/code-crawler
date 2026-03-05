import * as fs from 'fs';
import * as path from 'path';
import { extractGitData, analyzeGitSignals } from './git-analyzer.js';
import { extractStyleFeatures, analyzeStyleSignals } from './stylometric-analyzer.js';
import { extractStructuralFeatures, analyzeStructuralSignals } from './structural-analyzer.js';
import { buildFileResult } from './verdict-engine.js';
import { ForensicFileResult, ForensicReport, ForensicSignal } from './types.js';
import { execSync } from 'child_process';

export class ForensicSupervisor {
  private repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  analyzeCommit(commitRef: string): ForensicReport {
    const gitData = extractGitData(this.repoRoot, commitRef);
    const fileResults: ForensicFileResult[] = [];

    const changedFiles = execSync(
      `git diff-tree --no-commit-id --name-only -r ${commitRef}`,
      { cwd: this.repoRoot, encoding: 'utf-8' }
    ).trim().split('\n').filter(f => f.length > 0);

    for (const file of changedFiles) {
      const fullPath = path.join(this.repoRoot, file);
      if (!fs.existsSync(fullPath)) continue;

      const code = fs.readFileSync(fullPath, 'utf-8');
      const signals: ForensicSignal[] = [];

      signals.push(...analyzeGitSignals(gitData));
      signals.push(...analyzeStyleSignals(extractStyleFeatures(code), code));
      signals.push(...analyzeStructuralSignals(extractStructuralFeatures(code), code));

      fileResults.push(buildFileResult(file, code, signals));
    }

    return this.buildReport(fileResults, commitRef);
  }

  analyzeDiff(baseRef: string, headRef?: string): ForensicReport {
    const head = headRef || 'HEAD';
    const diffRange = `${baseRef}...${head}`;

    const changedFiles = execSync(
      `git diff --name-only ${diffRange}`,
      { cwd: this.repoRoot, encoding: 'utf-8' }
    ).trim().split('\n').filter(f => f.length > 0);

    const fileResults: ForensicFileResult[] = [];

    for (const file of changedFiles) {
      const fullPath = path.join(this.repoRoot, file);
      if (!fs.existsSync(fullPath)) continue;

      const code = fs.readFileSync(fullPath, 'utf-8');
      const signals: ForensicSignal[] = [];

      signals.push(...analyzeStyleSignals(extractStyleFeatures(code), code));
      signals.push(...analyzeStructuralSignals(extractStructuralFeatures(code), code));

      fileResults.push(buildFileResult(file, code, signals));
    }

    return this.buildReport(fileResults, diffRange);
  }

  analyzeFile(filePath: string): ForensicFileResult {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.repoRoot, filePath);

    const code = fs.readFileSync(fullPath, 'utf-8');
    const signals: ForensicSignal[] = [];

    signals.push(...analyzeStyleSignals(extractStyleFeatures(code), code));
    signals.push(...analyzeStructuralSignals(extractStructuralFeatures(code), code));

    return buildFileResult(filePath, code, signals);
  }

  analyzeBranch(branchName: string): ForensicReport {
    let mainBranch = 'main';
    try {
      execSync(`git rev-parse --verify main`, { cwd: this.repoRoot, encoding: 'utf-8' });
    } catch {
      mainBranch = 'master';
    }

    const mergeBase = execSync(
      `git merge-base ${mainBranch} ${branchName}`,
      { cwd: this.repoRoot, encoding: 'utf-8' }
    ).trim();

    return this.analyzeDiff(mergeBase, branchName);
  }

  private buildReport(files: ForensicFileResult[], sourceRef: string): ForensicReport {
    const totalLines = files.reduce((sum, f) => sum + f.lineVerdicts.length, 0);
    const totalConfidence = files.length > 0
      ? files.reduce((sum, f) => sum + f.confidence, 0) / files.length
      : 0;

    const allClassified = files.reduce((sum, f) =>
      sum + f.lineVerdicts.filter(v => v.verdict !== 'uncertain').length, 0);
    const allAi = files.reduce((sum, f) =>
      sum + f.lineVerdicts.filter(v => v.verdict === 'ai').length, 0);
    const allHuman = files.reduce((sum, f) =>
      sum + f.lineVerdicts.filter(v => v.verdict === 'human').length, 0);

    const denominator = allClassified || 1;

    return {
      files,
      overall: {
        aiPercentage: Math.round((allAi / denominator) * 100),
        humanPercentage: Math.round((allHuman / denominator) * 100),
        totalLinesAnalyzed: totalLines,
        confidence: totalConfidence,
      },
      analyzedAt: Date.now(),
      sourceRef,
    };
  }
}

export function saveLedger(repoRoot: string, report: ForensicReport): void {
  const ledgerDir = path.join(repoRoot, '.code-crawler', 'forensics');
  const ledgerPath = path.join(ledgerDir, 'ledger.json');

  fs.mkdirSync(ledgerDir, { recursive: true });

  let existing: ForensicReport[] = [];
  if (fs.existsSync(ledgerPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    } catch {
      existing = [];
    }
  }

  existing.push(report);
  fs.writeFileSync(ledgerPath, JSON.stringify(existing, null, 2), 'utf-8');
}

export function loadLedger(repoRoot: string): ForensicReport[] {
  const ledgerPath = path.join(repoRoot, '.code-crawler', 'forensics', 'ledger.json');
  if (!fs.existsSync(ledgerPath)) return [];

  try {
    return JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
  } catch {
    return [];
  }
}
