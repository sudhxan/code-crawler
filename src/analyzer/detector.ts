import { AnalysisResult, AnalysisContext, GitInfo } from './types.js';
import { allHeuristics } from './heuristics/index.js';
import { combineLineScores, summarize } from './scorer.js';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

const LANG_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go',
  '.rs': 'rust', '.java': 'java', '.c': 'c', '.cpp': 'cpp',
  '.cs': 'csharp', '.php': 'php', '.swift': 'swift',
};

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return LANG_MAP[ext] ?? 'unknown';
}

function getGitInfo(filePath: string): GitInfo | undefined {
  try {
    const dir = path.dirname(filePath);

    const log = execSync(`git log -1 --format="%H %s" -- "${filePath}"`, {
      cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!log) return undefined;

    const [hash, ...messageParts] = log.split(' ');
    const commitMessage = messageParts.join(' ');

    const stat = execSync(`git diff --numstat ${hash}~1..${hash} -- "${filePath}" 2>/dev/null || git diff --numstat 4b825dc642cb6eb9a060e54bf899d69f82cf7f2 ${hash} -- "${filePath}"`, {
      cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const parts = stat.split('\t');
    const addedLines = parseInt(parts[0], 10) || 0;

    // Check if file was new in that commit
    const diffOutput = execSync(`git diff --name-status ${hash}~1..${hash} -- "${filePath}" 2>/dev/null || echo "A"`, {
      cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const isNewFile = diffOutput.startsWith('A');

    return { commitSize: addedLines, addedLines, isNewFile, commitMessage };
  } catch {
    return undefined;
  }
}

export class CodeCrawlerDetector {
  async analyzeFile(filePath: string, gitInfo?: GitInfo): Promise<AnalysisResult> {
    const fs = await import('node:fs');
    const content = fs.readFileSync(filePath, 'utf-8');
    return analyzeCode(content, filePath);
  }

  async analyzeContent(content: string, filePath: string, gitInfo?: GitInfo): Promise<AnalysisResult> {
    return analyzeCode(content, filePath, true);
  }

  async analyzeDiff(diff: string): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const fileChunks = diff.split(/^diff --git/m).filter(Boolean);

    for (const chunk of fileChunks) {
      const fileMatch = chunk.match(/b\/(.+?)$/m);
      if (!fileMatch) continue;
      const filePath = fileMatch[1];

      // Extract added lines from the diff
      const addedLines = chunk
        .split('\n')
        .filter(l => l.startsWith('+') && !l.startsWith('+++'))
        .map(l => l.slice(1));

      if (addedLines.length === 0) continue;

      const content = addedLines.join('\n');
      results.push(analyzeCode(content, filePath, true));
    }

    return results;
  }
}

export function analyzeCode(content: string, filePath: string, skipGit = false): AnalysisResult {
  const lines = content.split('\n');

  const context: AnalysisContext = {
    filePath,
    language: detectLanguage(filePath),
    fullContent: content,
    gitInfo: skipGit ? undefined : getGitInfo(filePath),
  };

  const heuristicResults = allHeuristics.map(h => ({
    weight: h.weight,
    scores: h.analyze(lines, context),
  }));

  const lineScores = combineLineScores(heuristicResults);
  const summary = summarize(lineScores);

  return {
    filePath,
    overallScore: summary.aiPercentage / 100,
    lineScores,
    summary,
  };
}
