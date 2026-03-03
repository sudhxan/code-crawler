import { LineScore, AnalysisSummary } from './types.js';

const AI_THRESHOLD = 0.6;

export function combineLineScores(heuristicResults: { weight: number; scores: LineScore[] }[]): LineScore[] {
  if (heuristicResults.length === 0) return [];

  const lineCount = heuristicResults[0].scores.length;
  const totalWeight = heuristicResults.reduce((sum, h) => sum + h.weight, 0);

  const combined: LineScore[] = [];

  for (let i = 0; i < lineCount; i++) {
    let weightedSum = 0;
    const allSignals: LineScore['signals'] = [];

    for (const { weight, scores } of heuristicResults) {
      if (i < scores.length) {
        weightedSum += scores[i].aiProbability * weight;
        allSignals.push(...scores[i].signals);
      }
    }

    const aiProbability = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

    combined.push({
      lineNumber: i + 1,
      content: heuristicResults[0].scores[i]?.content ?? '',
      aiProbability,
      signals: allSignals,
    });
  }

  return combined;
}

export function summarize(lineScores: LineScore[]): AnalysisSummary {
  const totalLines = lineScores.length;
  if (totalLines === 0) {
    return { totalLines: 0, aiLines: 0, humanLines: 0, aiPercentage: 0, humanPercentage: 0, confidence: 0 };
  }

  const aiLines = lineScores.filter(l => l.aiProbability >= AI_THRESHOLD).length;
  const humanLines = totalLines - aiLines;

  const avgScore = lineScores.reduce((s, l) => s + l.aiProbability, 0) / totalLines;
  // Confidence: how far from 0.5 the average is (scaled to 0-1)
  const confidence = Math.min(1, Math.abs(avgScore - 0.5) * 2);

  return {
    totalLines,
    aiLines,
    humanLines,
    aiPercentage: Math.round((aiLines / totalLines) * 100),
    humanPercentage: Math.round((humanLines / totalLines) * 100),
    confidence,
  };
}
