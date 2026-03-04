import { describe, it, expect, beforeEach } from 'vitest';
import { PasteDetector } from '../../src/signals/paste-detector.js';

describe('PasteDetector', () => {
  let pd: PasteDetector;

  beforeEach(() => {
    pd = new PasteDetector();
  });

  it('should return 0.5 with insufficient data', () => {
    for (let i = 0; i < 5; i++) {
      pd.recordEdit(1000 + i * 200, 1, 0, 200);
    }
    expect(pd.getScore()).toBe(0.5);
  });

  it('should score low (human) for mostly small single-char edits', () => {
    let t = 1000;
    for (let i = 0; i < 30; i++) {
      t += 150;
      pd.recordEdit(t, 1, 0, 150);
    }
    expect(pd.getScore()).toBeLessThan(0.3);
  });

  it('should score high (AI) for frequent large inserts with short timeSinceLastEdit', () => {
    let t = 1000;
    for (let i = 0; i < 15; i++) {
      t += 50;
      pd.recordEdit(t, 200, 0, 50);
    }
    expect(pd.getScore()).toBeGreaterThan(0.7);
  });

  it('should score moderate for mixed typing and paste', () => {
    let t = 1000;
    // Some human typing
    for (let i = 0; i < 10; i++) {
      t += 150;
      pd.recordEdit(t, 1, 0, 150);
    }
    // Some paste events
    for (let i = 0; i < 5; i++) {
      t += 50;
      pd.recordEdit(t, 100, 0, 50);
    }
    const score = pd.getScore();
    expect(score).toBeGreaterThanOrEqual(0.2);
    expect(score).toBeLessThanOrEqual(0.85);
  });

  it('should detect paste when no recent single-char edits', () => {
    let t = 1000;
    // Large inserts with no preceding typing (timeSinceLastEdit > 100 but no single-char edits)
    for (let i = 0; i < 12; i++) {
      t += 5000;
      pd.recordEdit(t, 80, 0, 5000);
    }
    expect(pd.getScore()).toBeGreaterThan(0.7);
  });
});
