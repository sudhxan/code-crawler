import { describe, it, expect, beforeEach } from 'vitest';
import { ExtensionDetector } from '../../src/signals/extension-detector.js';

describe('ExtensionDetector', () => {
  let ed: ExtensionDetector;

  beforeEach(() => {
    ed = new ExtensionDetector();
  });

  it('should score > 0.9 for AI command 200ms before edit', () => {
    ed.recordCommand('github.copilot', 'copilot.accept', 1000);
    expect(ed.getScore(1200)).toBeGreaterThan(0.9);
  });

  it('should score 0.5 for AI command 5s before edit', () => {
    ed.recordCommand('github.copilot', 'copilot.accept', 1000);
    expect(ed.getScore(6000)).toBe(0.5);
  });

  it('should score 0.5 for non-AI command', () => {
    ed.recordCommand('ms-vscode.vscode-eslint', 'eslint.fix', 1000);
    expect(ed.getScore(1200)).toBe(0.5);
  });
});
