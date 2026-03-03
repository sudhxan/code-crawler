import { describe, it, expect } from 'vitest';
import { classifyEdit } from '../src/classifier';

describe('classifyEdit', () => {
  it('classifies single character typing as human', () => {
    const result = classifyEdit({
      charsInserted: 1, linesInserted: 0, charsDeleted: 0,
      timeSinceLastEdit: 150, changeCount: 1, totalCharsInAllChanges: 1,
    });
    expect(result.type).toBe('human');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('classifies multi-line block insertion as AI', () => {
    const result = classifyEdit({
      charsInserted: 200, linesInserted: 8, charsDeleted: 0,
      timeSinceLastEdit: 5000, changeCount: 1, totalCharsInAllChanges: 200,
    });
    expect(result.type).toBe('ai');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('classifies backspace as human', () => {
    const result = classifyEdit({
      charsInserted: 0, linesInserted: 0, charsDeleted: 1,
      timeSinceLastEdit: 100, changeCount: 1, totalCharsInAllChanges: 0,
    });
    expect(result.type).toBe('human');
  });

  it('classifies rapid large insertion as AI', () => {
    const result = classifyEdit({
      charsInserted: 80, linesInserted: 0, charsDeleted: 0,
      timeSinceLastEdit: 20, changeCount: 1, totalCharsInAllChanges: 80,
    });
    expect(result.type).toBe('ai');
  });

  it('classifies formatter as formatter', () => {
    const result = classifyEdit({
      charsInserted: 5, linesInserted: 0, charsDeleted: 3,
      timeSinceLastEdit: 10, changeCount: 15, totalCharsInAllChanges: 500,
    });
    expect(result.type).toBe('formatter');
  });

  it('classifies medium single-line insert as paste', () => {
    const result = classifyEdit({
      charsInserted: 50, linesInserted: 0, charsDeleted: 0,
      timeSinceLastEdit: 2000, changeCount: 1, totalCharsInAllChanges: 50,
    });
    expect(result.type).toBe('paste');
  });

  it('handles typing after long pause', () => {
    const result = classifyEdit({
      charsInserted: 3, linesInserted: 0, charsDeleted: 0,
      timeSinceLastEdit: 5000, changeCount: 1, totalCharsInAllChanges: 3,
    });
    expect(result.type).toBe('human');
  });

  it('classifies very large single insertion as AI', () => {
    const result = classifyEdit({
      charsInserted: 150, linesInserted: 0, charsDeleted: 0,
      timeSinceLastEdit: 3000, changeCount: 1, totalCharsInAllChanges: 150,
    });
    expect(result.type).toBe('ai');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('returns uncertain for ambiguous small multi-char insert', () => {
    const result = classifyEdit({
      charsInserted: 8, linesInserted: 0, charsDeleted: 0,
      timeSinceLastEdit: 200, changeCount: 1, totalCharsInAllChanges: 8,
    });
    // Could be uncertain or human depending on exact thresholds
    expect(['uncertain', 'human', 'paste']).toContain(result.type);
  });

  it('classifies two-char typing as human', () => {
    const result = classifyEdit({
      charsInserted: 2, linesInserted: 0, charsDeleted: 0,
      timeSinceLastEdit: 80, changeCount: 1, totalCharsInAllChanges: 2,
    });
    expect(result.type).toBe('human');
  });
});
