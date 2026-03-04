import { describe, it, expect, beforeEach } from 'vitest';
import { DeletionTracker } from '../../src/signals/deletion-tracker.js';

describe('DeletionTracker', () => {
  let dt: DeletionTracker;

  beforeEach(() => {
    dt = new DeletionTracker();
  });

  it('should return 0.5 with insufficient data', () => {
    for (let i = 0; i < 5; i++) {
      dt.recordEdit(1);
    }
    expect(dt.getScore()).toBe(0.5);
  });

  it('should score low (human) for backspace-heavy editing', () => {
    // Mostly small deletions (1-3 chars like backspace)
    for (let i = 0; i < 20; i++) {
      dt.recordEdit(1);
    }
    for (let i = 0; i < 3; i++) {
      dt.recordEdit(5);
    }
    expect(dt.getScore()).toBeLessThan(0.3);
  });

  it('should score high (AI) for block-replace editing', () => {
    // Mostly large deletions (block replacements)
    for (let i = 0; i < 12; i++) {
      dt.recordEdit(50);
    }
    for (let i = 0; i < 3; i++) {
      dt.recordEdit(2);
    }
    expect(dt.getScore()).toBeGreaterThan(0.7);
  });

  it('should score moderate for mixed deletion sizes', () => {
    for (let i = 0; i < 5; i++) {
      dt.recordEdit(1);
    }
    for (let i = 0; i < 5; i++) {
      dt.recordEdit(10);
    }
    for (let i = 0; i < 5; i++) {
      dt.recordEdit(30);
    }
    const score = dt.getScore();
    expect(score).toBeGreaterThanOrEqual(0.15);
    expect(score).toBeLessThanOrEqual(0.80);
  });

  it('should ignore zero-char deletions', () => {
    for (let i = 0; i < 20; i++) {
      dt.recordEdit(0);
    }
    expect(dt.getScore()).toBe(0.5);
  });
});
