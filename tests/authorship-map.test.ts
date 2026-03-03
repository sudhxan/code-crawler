import { describe, it, expect } from 'vitest';
import { AuthorshipMap } from '../src/authorship-map';
import type { Classification } from '../src/classifier';

const aiClassification: Classification = { type: 'ai', confidence: 0.95, reason: 'test' };
const humanClassification: Classification = { type: 'human', confidence: 0.90, reason: 'test' };
const formatterClassification: Classification = { type: 'formatter', confidence: 0.80, reason: 'test' };

describe('AuthorshipMap', () => {
  it('records AI insertion and marks lines as AI', () => {
    const map = new AuthorshipMap();
    map.recordEdit(0, 0, ['function foo() {', '  return 1;', '}'], aiClassification);

    expect(map.getLineAuthorship(0)?.author).toBe('ai');
    expect(map.getLineAuthorship(1)?.author).toBe('ai');
    expect(map.getLineAuthorship(2)?.author).toBe('ai');
  });

  it('records human edits on AI lines and transitions to mixed then human', () => {
    const map = new AuthorshipMap();
    map.recordEdit(0, 0, ['const x = 1;'], aiClassification);
    expect(map.getLineAuthorship(0)?.author).toBe('ai');

    // First human edit on AI line → mixed (humanEdits=1, below threshold of 5)
    map.recordEdit(0, 0, ['const x = 1; // edited'], humanClassification);
    expect(map.getLineAuthorship(0)?.author).toBe('mixed');

    // Continue human edits - stays mixed until threshold
    map.recordEdit(0, 0, ['const x = 1; // edit2'], humanClassification);
    map.recordEdit(0, 0, ['const x = 1; // edit3'], humanClassification);
    map.recordEdit(0, 0, ['const x = 1; // edit4'], humanClassification);
    expect(map.getLineAuthorship(0)?.author).toBe('mixed');

    // 5th human edit crosses threshold → human
    map.recordEdit(0, 0, ['const x = 1; // final'], humanClassification);
    expect(map.getLineAuthorship(0)?.author).toBe('human');
  });

  it('shifts lines correctly on deletion via shiftLines', () => {
    const map = new AuthorshipMap();
    map.recordEdit(0, 0, ['line0'], humanClassification);
    map.recordEdit(1, 0, ['line1'], aiClassification);
    map.recordEdit(2, 0, ['line2'], humanClassification);

    // Verify initial state
    expect(map.getLineAuthorship(0)?.author).toBe('human');
    expect(map.getLineAuthorship(1)?.author).toBe('ai');
    expect(map.getLineAuthorship(2)?.author).toBe('human');

    // Simulate deleting line 1: remove it, then shift lines >= 2 up by 1
    (map as any).lines.delete(1);
    map.shiftLines(2, -1);

    expect(map.getLineAuthorship(0)?.author).toBe('human');
    expect(map.getLineAuthorship(1)?.author).toBe('human'); // was line 2
    expect(map.getLineAuthorship(2)).toBeUndefined();
  });

  it('shifts lines correctly on insertion', () => {
    const map = new AuthorshipMap();
    map.recordEdit(0, 0, ['line0'], humanClassification);
    map.recordEdit(1, 0, ['line1'], aiClassification);

    // Shift lines >= 1 down by 2
    map.shiftLines(1, 2);

    // Line 1 moved to line 3
    expect(map.getLineAuthorship(3)?.author).toBe('ai');
    expect(map.getLineAuthorship(0)?.author).toBe('human');
    expect(map.getLineAuthorship(1)).toBeUndefined();
  });

  it('getSummary returns correct percentages', () => {
    const map = new AuthorshipMap();
    map.recordEdit(0, 0, ['human line'], humanClassification);
    map.recordEdit(1, 0, ['ai line 1', 'ai line 2'], aiClassification);

    const summary = map.getSummary();
    expect(summary.totalLines).toBe(3);
    expect(summary.humanLines).toBe(1);
    expect(summary.aiLines).toBe(2);
    expect(summary.humanPercentage).toBe(33);
    expect(summary.aiPercentage).toBe(67);
  });

  it('serializes and deserializes correctly', () => {
    const map = new AuthorshipMap();
    map.recordEdit(0, 0, ['human line'], humanClassification);
    map.recordEdit(1, 0, ['ai line'], aiClassification);

    const json = map.toJSON();
    const restored = AuthorshipMap.fromJSON(json);

    expect(restored.getLineAuthorship(0)?.author).toBe('human');
    expect(restored.getLineAuthorship(1)?.author).toBe('ai');
    expect(restored.getSummary().totalLines).toBe(2);
  });

  it('ignores formatter edits', () => {
    const map = new AuthorshipMap();
    map.recordEdit(0, 0, ['line'], humanClassification);
    map.recordEdit(0, 0, ['  line'], formatterClassification);

    expect(map.getLineAuthorship(0)?.author).toBe('human');
  });

  it('handles empty map summary', () => {
    const map = new AuthorshipMap();
    const summary = map.getSummary();
    expect(summary.totalLines).toBe(0);
    expect(summary.aiPercentage).toBe(0);
    expect(summary.humanPercentage).toBe(0);
  });
});
