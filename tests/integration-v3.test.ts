import { describe, it, expect } from 'vitest';
import { KeystrokeDynamics } from '../src/signals/keystroke-dynamics.js';
import { SequenceAnalyzer } from '../src/signals/sequence-analyzer.js';
import { CursorTracker } from '../src/signals/cursor-tracker.js';
import { UndoDetector } from '../src/signals/undo-detector.js';
import { AutoCloseFilter } from '../src/signals/auto-close-filter.js';
import { ExtensionDetector } from '../src/signals/extension-detector.js';
import { VelocityProfiler } from '../src/signals/velocity-profiler.js';
import { SelectionTracker } from '../src/signals/selection-tracker.js';
import { fuseSignals } from '../src/confidence-engine.js';

describe('Integration V3 - Full Session Simulation', () => {
  it('should classify a full human typing session as human', () => {
    const kd = new KeystrokeDynamics();
    const sa = new SequenceAnalyzer();
    const ct = new CursorTracker();
    const ud = new UndoDetector();
    const vp = new VelocityProfiler();

    let t = 100000;
    // 50 single-char edits with variable timing
    for (let i = 0; i < 50; i++) {
      t += 80 + Math.random() * 300;
      kd.recordEdit(t, 1);
      sa.recordEdit(Math.floor(i / 5) + 1, t);
      ct.recordCursorMove(Math.floor(i / 5), t - 50, false);
      ct.recordEdit();
      ud.recordEdit(String.fromCharCode(65 + (i % 26)), 0, i, undefined);
      vp.recordEdit(t, 1);
    }
    // 3 undos
    for (let i = 0; i < 3; i++) {
      t += 200;
      ud.recordEdit('', 0, 0, 1);
    }

    const scores = {
      typingRhythm: kd.getScore(),
      editSize: 0.15, // single chars
      cursorMovement: ct.getScore(),
      editSequence: sa.getScore(),
      undoFrequency: ud.getScore(),
      extensionSource: 0.5,
      velocityProfile: vp.getScore(),
      selectionPattern: 0.5,
    };

    const result = fuseSignals(scores, { type: 'human', confidence: 0.9, reason: 'test' });
    expect(result.type).toBe('human');
  });

  it('should classify AI block inserts as AI', () => {
    const kd = new KeystrokeDynamics();
    const sa = new SequenceAnalyzer();
    const ct = new CursorTracker();
    const ud = new UndoDetector();

    let t = 100000;
    // 2 large block inserts
    for (let i = 0; i < 2; i++) {
      t += 1000;
      kd.recordEdit(t, 200);
      sa.recordEdit(1 + i * 20, t);
      // No cursor moves
      for (let j = 0; j < 10; j++) {
        ud.recordEdit('x'.repeat(20), 0, i * 100 + j, undefined);
      }
    }

    const scores = {
      typingRhythm: kd.getScore(),
      editSize: 0.9,
      cursorMovement: ct.getScore(),
      editSequence: sa.getScore(),
      undoFrequency: ud.getScore(),
      extensionSource: 0.5,
      velocityProfile: 0.5,
      selectionPattern: 0.5,
    };

    const result = fuseSignals(scores, { type: 'ai', confidence: 0.95, reason: 'test' });
    expect(result.type).toBe('ai');
  });

  it('should transition from AI to mixed/human when human edits AI code', () => {
    const kd = new KeystrokeDynamics();
    const ud = new UndoDetector();

    let t = 100000;

    // First: large AI insert
    kd.recordEdit(t, 300);
    for (let i = 0; i < 5; i++) {
      ud.recordEdit('x'.repeat(60), 0, i * 10, undefined);
    }

    // Then: 20 small human edits
    for (let i = 0; i < 20; i++) {
      t += 100 + Math.random() * 200;
      kd.recordEdit(t, 1);
      ud.recordEdit('a', 0, 500 + i, undefined);
    }
    // Add some undos to signal human
    ud.recordEdit('', 0, 0, 1);
    ud.recordEdit('', 0, 0, 1);

    const scores = {
      typingRhythm: kd.getScore(),
      editSize: 0.3, // mixed
      cursorMovement: 0.3,
      editSequence: 0.5,
      undoFrequency: ud.getScore(),
      extensionSource: 0.5,
      velocityProfile: 0.5,
      selectionPattern: 0.5,
    };

    const result = fuseSignals(scores, { type: 'human', confidence: 0.7, reason: 'test' });
    // Should be human (undo override triggers since undoFrequency < 0.15)
    expect(result.type).toBe('human');
  });
});
