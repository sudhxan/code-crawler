import type { Classification } from './classifier.js';
import type { SignalScores } from './types.js';

export interface EnhancedClassification {
  type: 'ai' | 'human' | 'paste' | 'formatter' | 'uncertain';
  confidence: number;
  reason: string;
  signals: SignalScores;
  fusedConfidence: number;
  dominantSignal: string;
}

const WEIGHTS: Record<keyof SignalScores, number> = {
  typingRhythm: 0.20,
  editSize: 0.12,
  cursorMovement: 0.12,
  editSequence: 0.08,
  undoFrequency: 0.10,
  extensionSource: 0.10,
  velocityProfile: 0.05,
  selectionPattern: 0.05,
  pastePattern: 0.08,
  deletionPattern: 0.05,
  pausePattern: 0.05,
};

const DEFAULT_SCORES: SignalScores = {
  typingRhythm: 0.5, editSize: 0.5, cursorMovement: 0.5,
  editSequence: 0.5, undoFrequency: 0.5, extensionSource: 0.5,
  velocityProfile: 0.5, selectionPattern: 0.5,
  pastePattern: 0.5, deletionPattern: 0.5, pausePattern: 0.5,
};

export function fuseSignals(
  scores: Partial<SignalScores>,
  baseClassification: Classification,
): EnhancedClassification {
  const fullScores: SignalScores = { ...DEFAULT_SCORES, ...scores };

  // Override: extension source near-certain
  if (fullScores.extensionSource > 0.9) {
    return {
      type: 'ai', confidence: 0.98, reason: 'AI extension command detected',
      signals: fullScores, fusedConfidence: 0.98, dominantSignal: 'extensionSource',
    };
  }

  // Override: undo detected → definitely human
  if (fullScores.undoFrequency < 0.15) {
    return {
      type: 'human', confidence: 0.92, reason: 'Undo/redo pattern detected',
      signals: fullScores, fusedConfidence: 0.08, dominantSignal: 'undoFrequency',
    };
  }

  // Weighted fusion (only count signals with actual data)
  let weightedSum = 0;
  let totalWeight = 0;
  const activeSignals: { key: keyof SignalScores; score: number }[] = [];

  for (const [key, weight] of Object.entries(WEIGHTS) as [keyof SignalScores, number][]) {
    const score = fullScores[key];
    if (Math.abs(score - 0.5) > 0.01) {
      weightedSum += score * weight;
      totalWeight += weight;
      activeSignals.push({ key, score });
    }
  }

  let fusedScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  // Signal agreement/disagreement analysis
  const aiSignals = activeSignals.filter(s => s.score > 0.7);
  const humanSignals = activeSignals.filter(s => s.score < 0.3);

  if (aiSignals.length >= 3 && humanSignals.length === 0) {
    // Strong multi-signal AI agreement — boost toward AI
    fusedScore = Math.min(1, fusedScore + 0.10);
  } else if (humanSignals.length >= 3 && aiSignals.length === 0) {
    // Strong multi-signal human agreement — boost toward human
    fusedScore = Math.max(0, fusedScore - 0.10);
  } else if (aiSignals.length >= 2 && humanSignals.length >= 2) {
    // Contradictory signals — reduce confidence by pulling toward 0.5
    fusedScore = fusedScore * 0.7 + 0.5 * 0.3;
  }

  // Multi-signal corroboration: require at least 2 AI signals to classify as AI
  const needsCorroboration = aiSignals.length < 2 && fusedScore > 0.65;

  // Wider dead zone: 0.35-0.65 for more decisive classification
  let type: EnhancedClassification['type'];
  if (needsCorroboration) {
    type = baseClassification.type; // fall back, not enough corroboration
  } else if (fusedScore > 0.65) {
    type = 'ai';
  } else if (fusedScore < 0.35) {
    type = 'human';
  } else {
    type = baseClassification.type;
  }

  const confidence = Math.min(1, Math.abs(fusedScore - 0.5) * 2);

  // Find dominant signal
  let dominantSignal: keyof SignalScores = 'editSize';
  let maxDev = 0;
  for (const [key, val] of Object.entries(fullScores) as [keyof SignalScores, number][]) {
    const dev = Math.abs(val - 0.5);
    if (dev > maxDev) { maxDev = dev; dominantSignal = key; }
  }

  return {
    type, confidence,
    reason: `Fused: ${dominantSignal} (${fullScores[dominantSignal].toFixed(2)})` +
      (aiSignals.length >= 3 ? ' [corroborated]' : '') +
      (needsCorroboration ? ' [uncorroborated]' : ''),
    signals: fullScores, fusedConfidence: fusedScore, dominantSignal,
  };
}
