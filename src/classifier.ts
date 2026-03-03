export interface ClassificationInput {
  charsInserted: number;
  linesInserted: number;
  charsDeleted: number;
  timeSinceLastEdit: number;
  changeCount: number;
  totalCharsInAllChanges: number;
}

export interface Classification {
  type: 'ai' | 'human' | 'paste' | 'formatter' | 'uncertain';
  confidence: number;
  reason: string;
}

export function classifyEdit(input: ClassificationInput): Classification {
  const { charsInserted, linesInserted, charsDeleted, timeSinceLastEdit, changeCount, totalCharsInAllChanges } = input;

  // Auto-formatter detection: many small changes across the file in one event
  if (changeCount > 5 && totalCharsInAllChanges > 100) {
    return { type: 'formatter', confidence: 0.80, reason: 'Multiple simultaneous changes (likely formatter/refactor)' };
  }

  // STRONG AI SIGNALS
  if (linesInserted >= 2 && charsInserted > 30) {
    return { type: 'ai', confidence: 0.95, reason: 'Multi-line block insertion' };
  }

  if (charsInserted > 50 && timeSinceLastEdit < 50) {
    return { type: 'ai', confidence: 0.92, reason: 'Large instant insertion' };
  }

  if (charsInserted > 100) {
    return { type: 'ai', confidence: 0.88, reason: 'Very large single insertion (>100 chars)' };
  }

  // STRONG HUMAN SIGNALS
  if (charsInserted >= 1 && charsInserted <= 2 && charsDeleted === 0 && timeSinceLastEdit >= 30) {
    return { type: 'human', confidence: 0.92, reason: 'Character-by-character typing' };
  }

  if (charsDeleted > 0 && charsInserted <= 2) {
    return { type: 'human', confidence: 0.85, reason: 'Backspace/correction' };
  }

  if (charsInserted <= 5 && timeSinceLastEdit > 1000) {
    return { type: 'human', confidence: 0.80, reason: 'Typing after thinking pause' };
  }

  // PASTE DETECTION (single line, medium size)
  if (charsInserted > 10 && charsInserted <= 200 && linesInserted <= 1) {
    return { type: 'paste', confidence: 0.60, reason: 'Medium single-line insertion (likely paste)' };
  }

  return { type: 'uncertain', confidence: 0.50, reason: 'Ambiguous edit pattern' };
}
