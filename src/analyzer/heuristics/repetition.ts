import { Heuristic, LineScore, AnalysisContext } from '../types.js';

const WINDOW_SIZE = 10;

function normalizeLine(line: string): string {
  // Strip string literals
  let normalized = line.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '""');
  // Strip specific identifiers but keep structure keywords
  normalized = normalized.replace(/\b(?!if|else|for|while|return|const|let|var|function|class|switch|case|break|continue|throw|try|catch|finally|new|export|import|async|await|default)\b[a-zA-Z_$][a-zA-Z0-9_$]*/g, '_');
  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

function simpleHash(str: string): string {
  return str;
}

export const repetitionHeuristic: Heuristic = {
  name: 'repetition',
  weight: 0.15,

  analyze(lines: string[], _context: AnalysisContext): LineScore[] {
    const baseScores: LineScore[] = lines.map((content, i) => ({
      lineNumber: i + 1, content, aiProbability: 0.5, signals: [],
    }));

    if (lines.length < WINDOW_SIZE) return baseScores;

    // Build sliding windows
    const windows: { hash: string; start: number; end: number }[] = [];
    for (let i = 0; i <= lines.length - WINDOW_SIZE; i++) {
      const windowLines = lines.slice(i, i + WINDOW_SIZE).map(normalizeLine);
      const hash = simpleHash(windowLines.join('\n'));
      windows.push({ hash, start: i, end: i + WINDOW_SIZE - 1 });
    }

    // Count occurrences of each hash
    const hashCounts = new Map<string, number>();
    for (const w of windows) {
      hashCounts.set(w.hash, (hashCounts.get(w.hash) ?? 0) + 1);
    }

    // Mark lines that belong to repeated windows
    const repeatedLines = new Set<number>();
    let repeatedWindows = 0;
    for (const w of windows) {
      if ((hashCounts.get(w.hash) ?? 0) > 1) {
        repeatedWindows++;
        for (let i = w.start; i <= w.end; i++) {
          repeatedLines.add(i);
        }
      }
    }

    const repetitionRatio = windows.length > 0 ? repeatedWindows / windows.length : 0;

    let score: number;
    let reason: string;
    if (repetitionRatio > 0.3) {
      score = 0.80;
      reason = `High structural repetition (${(repetitionRatio * 100).toFixed(0)}% of windows repeat)`;
    } else if (repetitionRatio < 0.1) {
      score = 0.25;
      reason = `Low structural repetition (${(repetitionRatio * 100).toFixed(0)}%)`;
    } else {
      score = 0.5;
      reason = `Moderate structural repetition (${(repetitionRatio * 100).toFixed(0)}%)`;
    }

    for (const lineIdx of repeatedLines) {
      if (lineIdx < baseScores.length) {
        baseScores[lineIdx].aiProbability = score;
        baseScores[lineIdx].signals.push({ heuristic: 'repetition', score, reason });
      }
    }

    return baseScores;
  },
};
