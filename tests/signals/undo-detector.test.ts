import { describe, it, expect, beforeEach } from 'vitest';
import { UndoDetector } from '../../src/signals/undo-detector.js';

describe('UndoDetector', () => {
  let ud: UndoDetector;

  beforeEach(() => {
    ud = new UndoDetector();
  });

  it('should score < 0.2 for 10% undo rate', () => {
    // 30 normal edits + ~3 undos via reason=1
    for (let i = 0; i < 27; i++) {
      ud.recordEdit('x', 0, i, undefined);
    }
    for (let i = 0; i < 3; i++) {
      ud.recordEdit('', 0, 0, 1); // undo reason
    }
    // totalEdits = 30, undoCount = 3, rate = 0.1 > 0.03 → score 0.1
    expect(ud.getScore()).toBeLessThan(0.2);
  });

  it('should score > 0.7 for 0% undo over 60 edits', () => {
    for (let i = 0; i < 60; i++) {
      ud.recordEdit('a', 0, i * 10, undefined);
    }
    expect(ud.getScore()).toBeGreaterThan(0.7);
  });

  it('should detect reversed edit as undo', () => {
    ud.recordEdit('hello', 0, 10, undefined); // insert "hello" at offset 10
    ud.recordEdit('', 5, 10, undefined);       // delete 5 chars at offset 10 → reversal
    expect(ud.getUndoCount()).toBe(1);
  });

  it('should detect undo via reason=1', () => {
    ud.recordEdit('abc', 0, 0, undefined);
    ud.recordEdit('', 0, 0, 1); // undo reason
    expect(ud.getUndoCount()).toBe(1);
  });

  it('should return 0.5 with insufficient data', () => {
    for (let i = 0; i < 10; i++) {
      ud.recordEdit('x', 0, i, undefined);
    }
    expect(ud.getScore()).toBe(0.5);
  });
});
