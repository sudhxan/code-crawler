import { execSync } from 'child_process';
import { ForensicSignal, GitForensicData, DiffChunk } from './types.js';

function parseDiffChunks(diffText: string): DiffChunk[] {
  const chunks: DiffChunk[] = [];
  const fileSections = diffText.split(/^diff --git /m).filter(s => s.trim());

  for (const section of fileSections) {
    const fileMatch = section.match(/^a\/(.+?)\s+b\/(.+)/m);
    const filePath = fileMatch ? fileMatch[2] : '';

    const hunkRegex = /@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)\n([\s\S]*?)(?=\n@@|$)/g;
    let match: RegExpExecArray | null;

    while ((match = hunkRegex.exec(section)) !== null) {
      const body = match[6];
      const addedLines: string[] = [];
      const removedLines: string[] = [];

      for (const line of body.split('\n')) {
        if (line.startsWith('+')) addedLines.push(line.substring(1));
        else if (line.startsWith('-')) removedLines.push(line.substring(1));
      }

      chunks.push({
        filePath,
        startLine: parseInt(match[3], 10),
        addedLines,
        removedLines,
      });
    }
  }

  return chunks;
}

export function extractGitData(repoRoot: string, commitOrRef: string): GitForensicData {
  const execOpts = { cwd: repoRoot, encoding: 'utf-8' as const };

  let statOutput = '';
  try {
    statOutput = execSync(`git show --stat ${commitOrRef}`, execOpts);
  } catch {
    statOutput = '';
  }

  const authorMatch = statOutput.match(/^Author:\s+(.+?)\s+<(.+?)>$/m);
  const authorName = authorMatch ? authorMatch[1].trim() : 'unknown';
  const authorEmail = authorMatch ? authorMatch[2].trim() : 'unknown';

  const messageMatch = statOutput.match(/^Date:\s+.+\n\n([\s\S]*?)\n\n\s*\S+.*\|/m);
  const commitMessage = messageMatch ? messageMatch[1].trim() : '';

  const dateMatch = statOutput.match(/^Date:\s+(.+)$/m);
  const timestamp = dateMatch ? new Date(dateMatch[1].trim()).getTime() : Date.now();

  const statsMatch = statOutput.match(/(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/);
  const filesChanged = statsMatch ? parseInt(statsMatch[1], 10) : 0;
  const insertions = statsMatch && statsMatch[2] ? parseInt(statsMatch[2], 10) : 0;
  const deletions = statsMatch && statsMatch[3] ? parseInt(statsMatch[3], 10) : 0;

  let diffText = '';
  try {
    diffText = execSync(`git diff ${commitOrRef}~1..${commitOrRef}`, execOpts);
  } catch {
    try {
      diffText = execSync(`git diff --root ${commitOrRef}`, execOpts);
    } catch {
      diffText = '';
    }
  }

  const diffChunks = parseDiffChunks(diffText);

  // Extract commit hash
  let commitHash = commitOrRef;
  try {
    commitHash = execSync(`git rev-parse ${commitOrRef}`, execOpts).trim();
  } catch { /* use ref as-is */ }

  return {
    commitHash,
    authorName,
    authorEmail,
    commitMessage,
    timestamp,
    filesChanged,
    insertions,
    deletions,
    diffChunks,
  };
}

export function analyzeGitSignals(data: GitForensicData): ForensicSignal[] {
  const signals: ForensicSignal[] = [];

  // 1. Commit Size Signal
  {
    const evidence: string[] = [];
    let score: number;
    const ratio = data.deletions > 0 ? data.insertions / data.deletions : data.insertions;
    const total = data.insertions + data.deletions;

    if (data.insertions > 200 && ratio > 5) {
      score = 0.8;
      evidence.push(`Large commit with ${data.insertions} insertions and only ${data.deletions} deletions (ratio ${ratio.toFixed(1)})`);
      evidence.push('AI tends to produce large, complete implementations in a single commit');
    } else if (total < 50 && ratio < 3) {
      score = 0.2;
      evidence.push(`Small balanced commit: ${data.insertions} insertions, ${data.deletions} deletions`);
      evidence.push('Typical of incremental human editing');
    } else {
      score = 0.5;
      evidence.push(`Moderate commit: ${data.insertions} insertions, ${data.deletions} deletions`);
    }

    signals.push({ name: 'commitSize', score, confidence: 0.6, evidence });
  }

  // 2. Diff Shape Signal
  {
    const evidence: string[] = [];
    let score: number;

    if (data.diffChunks.length === 0) {
      score = 0.5;
      evidence.push('No diff chunks available for analysis');
    } else {
      const chunkSizes = data.diffChunks.map(c => c.addedLines.length);
      const maxChunkSize = Math.max(...chunkSizes);
      const avgChunkSize = chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length;
      const addOnlyChunks = data.diffChunks.filter(c => c.addedLines.length > 0 && c.removedLines.length === 0).length;
      const addOnlyRatio = addOnlyChunks / data.diffChunks.length;

      if (maxChunkSize >= 20 && avgChunkSize >= 10 && addOnlyRatio > 0.7) {
        score = 0.85;
        evidence.push(`Large contiguous additions: max hunk ${maxChunkSize} lines, avg ${avgChunkSize.toFixed(1)} lines`);
        evidence.push(`${(addOnlyRatio * 100).toFixed(0)}% of hunks are pure additions`);
      } else if (maxChunkSize < 10 && data.diffChunks.length > 3) {
        score = 0.15;
        evidence.push(`Scattered small edits across ${data.diffChunks.length} hunks (max ${maxChunkSize} lines)`);
      } else {
        score = 0.5;
        evidence.push(`Mixed diff shape: ${data.diffChunks.length} hunks, max size ${maxChunkSize}`);
      }
    }

    signals.push({ name: 'diffShape', score, confidence: 0.5, evidence });
  }

  // 3. Commit Message Signal
  {
    const evidence: string[] = [];
    let score: number;
    const msg = data.commitMessage;
    const hasConventionalFormat = /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(.+\))?[!]?:\s/.test(msg);
    const isLong = msg.length > 100;
    const isGeneric = /^(Update|Updated|Add|Added|Fix|Fixed|Remove|Removed)\s+\S+\.\w+$/i.test(msg);

    let aiIndicators = 0;
    if (hasConventionalFormat) { aiIndicators++; evidence.push('Uses conventional commit format'); }
    if (isLong) { aiIndicators++; evidence.push(`Message is ${msg.length} chars — overly descriptive`); }
    if (isGeneric) { aiIndicators++; evidence.push('Generic file-level message pattern'); }

    if (aiIndicators >= 2) score = 0.6;
    else if (aiIndicators === 1) score = 0.45;
    else { score = 0.3; evidence.push('Informal or terse message — typical of human commits'); }

    signals.push({ name: 'commitMessage', score, confidence: 0.4, evidence });
  }

  // 4. Timing Signal (weak — no inter-commit data)
  {
    const evidence: string[] = [];
    const linesChanged = data.insertions + data.deletions;
    const score = linesChanged > 300 ? 0.5 : 0.35;
    evidence.push(`${linesChanged} lines changed — timing signal inconclusive without inter-commit interval`);

    signals.push({ name: 'commitTiming', score, confidence: 0.3, evidence });
  }

  return signals;
}
