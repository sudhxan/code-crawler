import { describe, it, expect } from 'vitest';
import { fuseSignals } from '../src/confidence-engine.js';
import type { SignalScores } from '../src/types.js';

describe('fuseSignals', () => {
  const humanBase = { type: 'human' as const, confidence: 0.9, reason: 'test' };
  const aiBase = { type: 'ai' as const, confidence: 0.9, reason: 'test' };

  const neutralScores: SignalScores = {
    typingRhythm: 0.5, editSize: 0.5, cursorMovement: 0.5,
    editSequence: 0.5, undoFrequency: 0.5, extensionSource: 0.5,
    velocityProfile: 0.5, selectionPattern: 0.5,
    pastePattern: 0.5, deletionPattern: 0.5, pausePattern: 0.5,
  };

  it('should classify as human with high confidence for all-human signals', () => {
    const scores: SignalScores = {
      typingRhythm: 0.1, editSize: 0.1, cursorMovement: 0.1,
      editSequence: 0.1, undoFrequency: 0.2, extensionSource: 0.5,
      velocityProfile: 0.2, selectionPattern: 0.2,
      pastePattern: 0.15, deletionPattern: 0.15, pausePattern: 0.2,
    };
    const result = fuseSignals(scores, humanBase);
    expect(result.type).toBe('human');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify as AI with high confidence for all-AI signals', () => {
    const scores: SignalScores = {
      typingRhythm: 0.85, editSize: 0.9, cursorMovement: 0.85,
      editSequence: 0.8, undoFrequency: 0.8, extensionSource: 0.5,
      velocityProfile: 0.8, selectionPattern: 0.7,
      pastePattern: 0.8, deletionPattern: 0.8, pausePattern: 0.75,
    };
    const result = fuseSignals(scores, aiBase);
    expect(result.type).toBe('ai');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should have lower confidence for mixed signals', () => {
    const scores: SignalScores = {
      typingRhythm: 0.1, editSize: 0.9, cursorMovement: 0.1,
      editSequence: 0.9, undoFrequency: 0.5, extensionSource: 0.5,
      velocityProfile: 0.5, selectionPattern: 0.5,
      pastePattern: 0.5, deletionPattern: 0.5, pausePattern: 0.5,
    };
    const result = fuseSignals(scores, humanBase);
    expect(result.confidence).toBeLessThan(0.9);
  });

  it('should override to AI with 0.98 confidence for extension source', () => {
    const scores: Partial<SignalScores> = {
      extensionSource: 0.95,
    };
    const result = fuseSignals(scores, humanBase);
    expect(result.type).toBe('ai');
    expect(result.confidence).toBe(0.98);
  });

  it('should override to human for undo detection', () => {
    const scores: Partial<SignalScores> = {
      undoFrequency: 0.1,
    };
    const result = fuseSignals(scores, aiBase);
    expect(result.type).toBe('human');
    expect(result.confidence).toBe(0.92);
  });

  it('should fall back to base classification for all-neutral signals', () => {
    const result = fuseSignals(neutralScores, humanBase);
    expect(result.type).toBe('human');
  });

  it('should boost confidence when 3+ signals agree on AI', () => {
    const scores: SignalScores = {
      ...neutralScores,
      typingRhythm: 0.85, editSize: 0.8, cursorMovement: 0.75,
    };
    const result = fuseSignals(scores, aiBase);
    expect(result.type).toBe('ai');
    expect(result.reason).toContain('corroborated');
  });

  it('should reduce confidence when signals contradict', () => {
    const scores: SignalScores = {
      ...neutralScores,
      typingRhythm: 0.1, editSize: 0.1,     // human signals
      pastePattern: 0.85, deletionPattern: 0.85, // AI signals
    };
    const result = fuseSignals(scores, humanBase);
    // Contradictory: confidence should be pulled toward center
    expect(result.confidence).toBeLessThan(0.7);
  });

  it('should require corroboration for AI classification', () => {
    const scores: SignalScores = {
      ...neutralScores,
      typingRhythm: 0.80, // only 1 AI signal
    };
    const result = fuseSignals(scores, humanBase);
    // Single signal shouldn't override base classification
    expect(result.type).toBe('human');
    expect(result.reason).toContain('uncorroborated');
  });
});
