import { describe, it, expect, beforeEach } from 'vitest';
import { SequenceAnalyzer } from '../../src/signals/sequence-analyzer.js';

describe('SequenceAnalyzer', () => {
  let sa: SequenceAnalyzer;

  beforeEach(() => {
    sa = new SequenceAnalyzer();
  });

  it('should have directionality > 0.7 for linear editing', () => {
    for (let i = 1; i <= 15; i++) {
      sa.recordEdit(i, 1000 + i * 200);
    }
    expect(sa.getDirectionalityScore()).toBeGreaterThan(0.7);
  });

  it('should have directionality < 0.3 for jumping around', () => {
    const lines = [5, 50, 12, 80, 3, 60, 15, 90, 2, 70];
    lines.forEach((line, i) => sa.recordEdit(line, 1000 + i * 200));
    expect(sa.getDirectionalityScore()).toBeLessThan(0.3);
  });

  it('should have locality > 0.6 for single-region editing', () => {
    for (let i = 0; i < 20; i++) {
      sa.recordEdit(5 + (i % 3), 1000 + i * 200); // lines 5-7
    }
    expect(sa.getLocalityScore()).toBeGreaterThan(0.6);
  });

  it('should have locality < 0.3 for multi-region editing', () => {
    const regions = [5, 50, 105, 200, 305, 10, 55, 110, 205, 310,
                     15, 60, 115, 210, 315, 20, 65, 120, 215, 320];
    regions.forEach((line, i) => sa.recordEdit(line, 1000 + i * 200));
    expect(sa.getLocalityScore()).toBeLessThan(0.3);
  });

  it('should return combined score from directionality and locality', () => {
    // Linear + single region → high combined
    for (let i = 1; i <= 20; i++) {
      sa.recordEdit(i, 1000 + i * 200);
    }
    const score = sa.getScore();
    const dir = sa.getDirectionalityScore();
    const loc = sa.getLocalityScore();
    expect(score).toBeCloseTo(dir * 0.6 + loc * 0.4, 5);
  });
});
