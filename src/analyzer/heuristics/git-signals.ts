import { Heuristic, LineScore, AnalysisContext } from '../types.js';

const GENERIC_COMMIT_MESSAGES = [
  /^(initial commit|first commit|init)$/i,
  /^add(ed|s)?\s+\w+\s*(file|component|module|function|feature)/i,
  /^implement(ed|s)?\s+\w+/i,
  /^create(d|s)?\s+\w+/i,
  /^update(d|s)?\s+\w+/i,
  /^feat:\s/i,
  /^fix:\s/i,
];

export const gitSignalsHeuristic: Heuristic = {
  name: 'git-signals',
  weight: 0.2,

  analyze(lines: string[], context: AnalysisContext): LineScore[] {
    const git = context.gitInfo;

    if (!git) {
      return lines.map((content, i) => ({
        lineNumber: i + 1, content, aiProbability: 0.5, signals: [],
      }));
    }

    let score = 0.5;
    const reasons: string[] = [];

    // Large additions in single commit
    if (git.addedLines > 100) {
      score += 0.2;
      reasons.push(`Large addition: ${git.addedLines} lines`);
    } else if (git.addedLines > 50) {
      score += 0.1;
      reasons.push(`Moderate addition: ${git.addedLines} lines`);
    }

    // New file with substantial content
    if (git.isNewFile && lines.length > 50) {
      score += 0.15;
      reasons.push('New file with complete implementation');
    }

    // Generic commit message
    if (GENERIC_COMMIT_MESSAGES.some(p => p.test(git.commitMessage))) {
      score += 0.1;
      reasons.push('Generic commit message');
    }

    score = Math.min(score, 1);

    const signals = reasons.length > 0
      ? [{ heuristic: 'git-signals', score, reason: reasons.join('; ') }]
      : [];

    return lines.map((content, i) => ({
      lineNumber: i + 1, content, aiProbability: score, signals: i === 0 ? signals : [],
    }));
  },
};
