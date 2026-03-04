import * as vscode from 'vscode';
import type { AuthorshipMap } from '../../src/authorship-map';
import type { SignalScores } from '../../src/types';

// Confidence levels: high (>0.8), medium (0.5-0.8), low (<0.5)
function createDeco(color: string, opacity: number): vscode.TextEditorDecorationType {
  const borderOpacity = opacity;
  const bgOpacity = opacity * 0.1;
  return vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    borderWidth: '0 0 0 3px',
    borderStyle: 'solid',
    borderColor: color.replace('OPACITY', String(borderOpacity)),
    backgroundColor: color.replace('OPACITY', String(bgOpacity)),
  });
}

// AI: red, Human: green, Mixed: yellow
const aiHigh = createDeco('rgba(255, 100, 80, OPACITY)', 0.8);
const aiMedium = createDeco('rgba(255, 100, 80, OPACITY)', 0.5);
const aiLow = createDeco('rgba(255, 100, 80, OPACITY)', 0.25);

const humanHigh = createDeco('rgba(80, 200, 120, OPACITY)', 0.8);
const humanMedium = createDeco('rgba(80, 200, 120, OPACITY)', 0.5);
const humanLow = createDeco('rgba(80, 200, 120, OPACITY)', 0.25);

const mixedHigh = createDeco('rgba(255, 200, 60, OPACITY)', 0.8);
const mixedMedium = createDeco('rgba(255, 200, 60, OPACITY)', 0.5);
const mixedLow = createDeco('rgba(255, 200, 60, OPACITY)', 0.25);

const allDecorations = [
  aiHigh, aiMedium, aiLow,
  humanHigh, humanMedium, humanLow,
  mixedHigh, mixedMedium, mixedLow,
];

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence > 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function getDecoration(author: string, level: 'high' | 'medium' | 'low'): vscode.TextEditorDecorationType {
  if (author === 'ai') return level === 'high' ? aiHigh : level === 'medium' ? aiMedium : aiLow;
  if (author === 'human') return level === 'high' ? humanHigh : level === 'medium' ? humanMedium : humanLow;
  return level === 'high' ? mixedHigh : level === 'medium' ? mixedMedium : mixedLow;
}

export function applyDecorations(editor: vscode.TextEditor, map: AuthorshipMap): void {
  const buckets = new Map<vscode.TextEditorDecorationType, vscode.DecorationOptions[]>();
  for (const deco of allDecorations) buckets.set(deco, []);

  for (const line of map.getAllLines()) {
    if (line.line < 0 || line.line >= editor.document.lineCount) continue;
    const range = new vscode.Range(line.line, 0, line.line, 0);
    const level = getConfidenceLevel(line.confidence);
    const deco = getDecoration(line.author, level);
    const confidencePct = Math.round(line.confidence * 100);

    const dominantSignal = line.signals?.typingRhythm !== undefined
      ? getDominantSignalName(line.signals) : '';
    const hoverMsg = `${line.author.toUpperCase()} (${confidencePct}% confidence)${dominantSignal ? ` | Signal: ${dominantSignal}` : ''}`;

    buckets.get(deco)!.push({
      range,
      hoverMessage: new vscode.MarkdownString(hoverMsg),
    });
  }

  for (const [deco, ranges] of buckets) {
    editor.setDecorations(deco, ranges);
  }
}

function getDominantSignalName(signals: SignalScores): string {
  let best = '';
  let maxDev = 0;
  for (const [key, val] of Object.entries(signals)) {
    const dev = Math.abs(val - 0.5);
    if (dev > maxDev) { maxDev = dev; best = key; }
  }
  return best;
}

export function clearDecorations(editor: vscode.TextEditor): void {
  for (const deco of allDecorations) editor.setDecorations(deco, []);
}

export function disposeDecorations(): void {
  for (const deco of allDecorations) deco.dispose();
}
