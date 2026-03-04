import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionTracker } from '../../src/signals/selection-tracker.js';

describe('SelectionTracker', () => {
  let st: SelectionTracker;

  beforeEach(() => {
    st = new SelectionTracker();
  });

  it('should score < 0.3 for selection before replace', () => {
    st.recordSelection(5, 10, 4000); // selected lines 5-10 at t=4000
    const score = st.getScore(5, 10, 5000, true); // replace at t=5000
    expect(score).toBeLessThan(0.3);
  });

  it('should score > 0.6 for replace without prior selection', () => {
    const score = st.getScore(5, 10, 5000, true);
    expect(score).toBeGreaterThan(0.6);
  });

  it('should score 0.5 for non-replace edit', () => {
    st.recordSelection(5, 10, 4000);
    const score = st.getScore(5, 10, 5000, false);
    expect(score).toBe(0.5);
  });
});
