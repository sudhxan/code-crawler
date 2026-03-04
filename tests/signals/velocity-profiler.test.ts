import { describe, it, expect, beforeEach } from 'vitest';
import { VelocityProfiler } from '../../src/signals/velocity-profiler.js';

describe('VelocityProfiler', () => {
  let vp: VelocityProfiler;

  beforeEach(() => {
    vp = new VelocityProfiler();
  });

  it('should score < 0.4 for steady typing', () => {
    const now = 400000;
    // Spread 60 edits evenly across 300s, ~5 chars each (enough for median > 30)
    for (let i = 0; i < 60; i++) {
      vp.recordEdit(now - 300000 + i * 5000, 5);
    }
    expect(vp.getScore()).toBeLessThan(0.4);
  });

  it('should score > 0.7 for spike pattern', () => {
    const now = 400000;
    // Most windows have ~2 chars, but one window has a huge spike
    for (let i = 0; i < 15; i++) {
      vp.recordEdit(now - 280000 + i * 20000, 2);
    }
    // Big spike in the last window
    vp.recordEdit(now - 5000, 500);
    vp.recordEdit(now - 4000, 500);
    vp.recordEdit(now - 3000, 500);
    expect(vp.getScore()).toBeGreaterThan(0.7);
  });

  it('should return 0.5 with insufficient data', () => {
    vp.recordEdit(1000, 5);
    vp.recordEdit(2000, 5);
    expect(vp.getScore()).toBe(0.5);
  });
});
