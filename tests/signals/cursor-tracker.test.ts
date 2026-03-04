import { describe, it, expect, beforeEach } from 'vitest';
import { CursorTracker } from '../../src/signals/cursor-tracker.js';

describe('CursorTracker', () => {
  let ct: CursorTracker;

  beforeEach(() => {
    ct = new CursorTracker();
  });

  it('should score < 0.3 for high cursor-to-edit ratio', () => {
    // 30 cursor moves, 10 edits → ratio = 3
    for (let i = 0; i < 30; i++) {
      ct.recordCursorMove(i, 1000 + i * 100, false);
    }
    for (let i = 0; i < 10; i++) {
      ct.recordEdit();
    }
    expect(ct.getScore()).toBeLessThan(0.3);
  });

  it('should score > 0.7 for low cursor-to-edit ratio', () => {
    // 2 cursor moves, 10 edits → ratio = 0.2
    ct.recordCursorMove(1, 1000, false);
    ct.recordCursorMove(2, 1100, false);
    for (let i = 0; i < 10; i++) {
      ct.recordEdit();
    }
    expect(ct.getScore()).toBeGreaterThan(0.7);
  });

  it('should detect pre-edit cursor move', () => {
    ct.recordCursorMove(10, 5000, false);
    expect(ct.hadPreEditCursorMove(10, 6000)).toBe(true);
  });

  it('should return false when no pre-edit cursor move', () => {
    // No cursor moves recorded
    expect(ct.hadPreEditCursorMove(10, 6000)).toBe(false);
  });
});
