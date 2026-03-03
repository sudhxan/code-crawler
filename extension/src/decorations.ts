import * as vscode from 'vscode';
import type { AuthorshipMap } from '../../src/authorship-map';

const aiDecoration = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  borderWidth: '0 0 0 3px',
  borderStyle: 'solid',
  borderColor: 'rgba(255, 100, 80, 0.6)',
  backgroundColor: 'rgba(255, 100, 80, 0.06)',
});

const humanDecoration = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  borderWidth: '0 0 0 3px',
  borderStyle: 'solid',
  borderColor: 'rgba(80, 200, 120, 0.6)',
  backgroundColor: 'rgba(80, 200, 120, 0.06)',
});

const mixedDecoration = vscode.window.createTextEditorDecorationType({
  isWholeLine: true,
  borderWidth: '0 0 0 3px',
  borderStyle: 'solid',
  borderColor: 'rgba(255, 200, 60, 0.6)',
  backgroundColor: 'rgba(255, 200, 60, 0.06)',
});

export function applyDecorations(editor: vscode.TextEditor, map: AuthorshipMap): void {
  const aiRanges: vscode.Range[] = [];
  const humanRanges: vscode.Range[] = [];
  const mixedRanges: vscode.Range[] = [];

  for (const line of map.getAllLines()) {
    if (line.line < 0 || line.line >= editor.document.lineCount) continue;
    const range = new vscode.Range(line.line, 0, line.line, 0);

    if (line.author === 'ai') aiRanges.push(range);
    else if (line.author === 'human') humanRanges.push(range);
    else mixedRanges.push(range);
  }

  editor.setDecorations(aiDecoration, aiRanges);
  editor.setDecorations(humanDecoration, humanRanges);
  editor.setDecorations(mixedDecoration, mixedRanges);
}

export function clearDecorations(editor: vscode.TextEditor): void {
  editor.setDecorations(aiDecoration, []);
  editor.setDecorations(humanDecoration, []);
  editor.setDecorations(mixedDecoration, []);
}

export function disposeDecorations(): void {
  aiDecoration.dispose();
  humanDecoration.dispose();
  mixedDecoration.dispose();
}
