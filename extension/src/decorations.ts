import * as vscode from 'vscode';
import type { AnalysisResult } from '../../src/analyzer/types';

const decorationTypes: vscode.TextEditorDecorationType[] = [];

// Pre-create decoration types for different AI probability bands
function getDecorationForProbability(prob: number): vscode.TextEditorDecorationType {
  if (prob >= 0.8) {
    return vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 80, 80, 0.12)',
      overviewRulerColor: 'rgba(255, 80, 80, 0.6)',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
    });
  } else if (prob >= 0.6) {
    return vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 160, 80, 0.08)',
    });
  } else if (prob <= 0.2) {
    return vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(80, 200, 80, 0.08)',
    });
  } else {
    return vscode.window.createTextEditorDecorationType({});
  }
}

export function applyDecorations(
  editor: vscode.TextEditor,
  result: AnalysisResult,
): void {
  clearDecorations();

  // Group lines by probability band
  const bands: Map<string, { type: vscode.TextEditorDecorationType; ranges: vscode.Range[] }> = new Map();

  for (const line of result.lineScores) {
    const lineIdx = line.lineNumber - 1;
    if (lineIdx < 0 || lineIdx >= editor.document.lineCount) continue;

    const bandKey = line.aiProbability >= 0.8 ? 'high'
      : line.aiProbability >= 0.6 ? 'med'
      : line.aiProbability <= 0.2 ? 'human'
      : 'neutral';

    if (!bands.has(bandKey)) {
      bands.set(bandKey, { type: getDecorationForProbability(line.aiProbability), ranges: [] });
    }

    const range = new vscode.Range(lineIdx, 0, lineIdx, editor.document.lineAt(lineIdx).text.length);
    bands.get(bandKey)!.ranges.push(range);
  }

  for (const { type, ranges } of bands.values()) {
    decorationTypes.push(type);
    editor.setDecorations(type, ranges);
  }
}

export function clearDecorations(): void {
  for (const dt of decorationTypes) {
    dt.dispose();
  }
  decorationTypes.length = 0;
}
