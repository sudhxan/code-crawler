import { ForensicSignal, ForensicLineVerdict, ForensicFileResult } from './types.js';

/**
 * Fuse multiple forensic signals into a single score and confidence.
 */
export function fuseForensicSignals(signals: ForensicSignal[]): { score: number; confidence: number } {
  if (signals.length === 0) {
    return { score: 0.5, confidence: 0 };
  }

  const totalWeight = signals.reduce((sum, s) => sum + s.confidence, 0);
  if (totalWeight === 0) {
    return { score: 0.5, confidence: 0 };
  }

  const score = signals.reduce((sum, s) => sum + s.score * s.confidence, 0) / totalWeight;

  let confidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;

  // Boost if signals agree, reduce if they conflict
  const allAiLeaning = signals.every(s => s.score > 0.6);
  const allHumanLeaning = signals.every(s => s.score < 0.4);

  if (allAiLeaning || allHumanLeaning) {
    confidence = Math.min(1, confidence * 1.2);
  } else {
    const hasAi = signals.some(s => s.score > 0.6);
    const hasHuman = signals.some(s => s.score < 0.4);
    if (hasAi && hasHuman) {
      confidence *= 0.8;
    }
  }

  return { score, confidence };
}

/**
 * Classify each line of code with an AI/human/uncertain verdict.
 */
export function classifyLines(lines: string[], fileSignals: ForensicSignal[]): ForensicLineVerdict[] {
  const fused = fuseForensicSignals(fileSignals);
  const fileVerdict: 'ai' | 'human' | 'uncertain' =
    fused.score > 0.6 ? 'ai' : fused.score < 0.4 ? 'human' : 'uncertain';

  // Compute average line length for outlier detection
  const substantialLines = lines.filter(l => l.trim().length > 0);
  const avgLineLength = substantialLines.length > 0
    ? substantialLines.reduce((sum, l) => sum + l.length, 0) / substantialLines.length
    : 0;

  return lines.map((content, index): ForensicLineVerdict => {
    const trimmed = content.trim();

    // Empty/whitespace lines
    if (trimmed.length === 0) {
      return { line: index + 1, content, verdict: 'uncertain', confidence: 0, signals: [] };
    }

    // Import/export only lines
    if (/^(import\s|export\s|from\s|require\()/.test(trimmed)) {
      return {
        line: index + 1, content,
        verdict: fileVerdict === 'uncertain' ? 'uncertain' : fileVerdict,
        confidence: fused.confidence * 0.5,
        signals: fileSignals,
      };
    }

    // Lines with TODO/FIXME/HACK
    if (/\b(TODO|FIXME|HACK)\b/.test(trimmed)) {
      return {
        line: index + 1, content,
        verdict: 'human',
        confidence: 0.8,
        signals: [{
          name: 'todo-marker',
          score: 0.1,
          confidence: 0.8,
          evidence: ['Line contains TODO/FIXME/HACK marker'],
        }],
      };
    }

    // Closing braces/brackets only
    if (/^[}\]);,]*$/.test(trimmed)) {
      return {
        line: index + 1, content,
        verdict: fileVerdict === 'uncertain' ? 'uncertain' : fileVerdict,
        confidence: fused.confidence * 0.3,
        signals: fileSignals,
      };
    }

    // Substantial code lines: per-line micro-analysis
    let lineScore = fused.score;
    let lineConfidence = fused.confidence;

    // Descriptive inline comment → slight AI lean
    const inlineCommentMatch = trimmed.match(/\/\/\s*(.+)$/);
    if (inlineCommentMatch && inlineCommentMatch[1].trim().length > 10) {
      lineScore = lineScore * 0.7 + 0.3 * 0.7; // nudge toward AI
      lineConfidence = Math.min(1, lineConfidence * 1.05);
    }

    // Line length outlier → slight human lean
    if (avgLineLength > 0) {
      const deviation = Math.abs(content.length - avgLineLength);
      if (deviation > avgLineLength * 0.6) {
        lineScore = lineScore * 0.8 + 0.2 * 0.3; // nudge toward human
        lineConfidence = Math.min(1, lineConfidence * 1.05);
      }
    }

    const verdict: 'ai' | 'human' | 'uncertain' =
      lineScore > 0.6 ? 'ai' : lineScore < 0.4 ? 'human' : 'uncertain';

    return {
      line: index + 1,
      content,
      verdict,
      confidence: lineConfidence,
      signals: fileSignals,
    };
  });
}

/**
 * Build a complete ForensicFileResult from signals and source code.
 */
export function buildFileResult(filePath: string, code: string, signals: ForensicSignal[]): ForensicFileResult {
  const lines = code.split('\n');
  const lineVerdicts = classifyLines(lines, signals);

  const classified = lineVerdicts.filter(v => v.verdict !== 'uncertain');
  const aiCount = classified.filter(v => v.verdict === 'ai').length;
  const humanCount = classified.filter(v => v.verdict === 'human').length;
  const total = classified.length || 1;

  const aiPercentage = Math.round((aiCount / total) * 100);
  const humanPercentage = Math.round((humanCount / total) * 100);

  const fused = fuseForensicSignals(signals);
  let overallVerdict: 'ai' | 'human' | 'mixed' | 'uncertain';
  if (fused.confidence < 0.2) {
    overallVerdict = 'uncertain';
  } else if (fused.score > 0.6) {
    overallVerdict = 'ai';
  } else if (fused.score < 0.4) {
    overallVerdict = 'human';
  } else {
    overallVerdict = 'mixed';
  }

  return {
    filePath,
    overallVerdict,
    aiPercentage,
    humanPercentage,
    confidence: fused.confidence,
    lineVerdicts,
    signals,
    analyzedAt: Date.now(),
  };
}
