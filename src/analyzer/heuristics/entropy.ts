import { Heuristic, LineScore, AnalysisContext } from '../types.js';

function bigramEntropy(text: string): number {
  if (text.length < 3) return 0;

  const counts = new Map<string, number>();
  let total = 0;

  for (let i = 0; i < text.length - 1; i++) {
    const bigram = text[i] + text[i + 1];
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    total++;
  }

  if (total === 0) return 0;

  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }

  return entropy;
}

// Typical ranges: AI code ~3.5-5.0, human code ~5.0-7.0
const LOW_ENTROPY_THRESHOLD = 4.0;
const HIGH_ENTROPY_THRESHOLD = 6.0;

export const entropyHeuristic: Heuristic = {
  name: 'entropy',
  weight: 0.15,

  analyze(lines: string[], _context: AnalysisContext): LineScore[] {
    // Calculate entropy on sliding windows of 5 lines for stability
    const windowSize = 5;

    return lines.map((content, i) => {
      if (content.trim().length < 5) {
        return { lineNumber: i + 1, content, aiProbability: 0.5, signals: [] };
      }

      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(lines.length, i + Math.ceil(windowSize / 2));
      const window = lines.slice(start, end).join('\n');

      const entropy = bigramEntropy(window);

      let score: number;
      if (entropy <= LOW_ENTROPY_THRESHOLD) {
        score = 0.8; // Low entropy = likely AI
      } else if (entropy >= HIGH_ENTROPY_THRESHOLD) {
        score = 0.2; // High entropy = likely human
      } else {
        // Linear interpolation
        score = 0.8 - (entropy - LOW_ENTROPY_THRESHOLD) / (HIGH_ENTROPY_THRESHOLD - LOW_ENTROPY_THRESHOLD) * 0.6;
      }

      const signals = Math.abs(score - 0.5) > 0.15
        ? [{ heuristic: 'entropy', score, reason: `Bigram entropy: ${entropy.toFixed(2)}` }]
        : [];

      return { lineNumber: i + 1, content, aiProbability: score, signals };
    });
  },
};
