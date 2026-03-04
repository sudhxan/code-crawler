import { describe, it, expect, beforeEach } from 'vitest';
import { PauseAnalyzer } from '../../src/signals/pause-analyzer.js';

describe('PauseAnalyzer', () => {
  let pa: PauseAnalyzer;

  beforeEach(() => {
    pa = new PauseAnalyzer();
  });

  it('should return 0.5 with insufficient data', () => {
    pa.recordEdit(1000, 5);
    pa.recordEdit(5000, 10);
    pa.recordEdit(9000, 8);
    expect(pa.getScore()).toBe(0.5);
  });

  it('should score low (human) for think-then-type pattern', () => {
    let t = 1000;
    // Human pattern: pause 2-30s then type a few chars
    for (let i = 0; i < 10; i++) {
      t += 5000; // 5s pause
      pa.recordEdit(t, 10); // type a small amount
    }
    expect(pa.getScore()).toBeLessThan(0.3);
  });

  it('should score high (AI) for wait-then-dump pattern', () => {
    let t = 1000;
    pa.recordEdit(t, 1); // initial edit
    // AI pattern: long pause then large insertion
    for (let i = 0; i < 8; i++) {
      t += 15000; // 15s pause (waiting for AI generation)
      pa.recordEdit(t, 200); // large dump
    }
    expect(pa.getScore()).toBeGreaterThan(0.7);
  });

  it('should score moderate for mixed patterns', () => {
    let t = 1000;
    pa.recordEdit(t, 1);
    // Some human pauses
    for (let i = 0; i < 4; i++) {
      t += 5000;
      pa.recordEdit(t, 10);
    }
    // Some AI pauses
    for (let i = 0; i < 3; i++) {
      t += 15000;
      pa.recordEdit(t, 150);
    }
    const score = pa.getScore();
    expect(score).toBeGreaterThanOrEqual(0.15);
    expect(score).toBeLessThanOrEqual(0.80);
  });

  it('should not count gaps under 2000ms as pauses', () => {
    let t = 1000;
    for (let i = 0; i < 20; i++) {
      t += 500; // all gaps under 2s
      pa.recordEdit(t, 5);
    }
    // No pause events recorded, insufficient data
    expect(pa.getScore()).toBe(0.5);
  });
});
