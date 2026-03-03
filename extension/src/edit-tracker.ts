import * as vscode from 'vscode';
import { classifyEdit } from '../../src/classifier';
import { AuthorshipMap } from '../../src/authorship-map';
import type { Classification } from '../../src/classifier';

export class EditTracker {
  private lastEditTime: Map<string, number> = new Map();
  private authorshipMaps: Map<string, AuthorshipMap> = new Map();
  private disposables: vscode.Disposable[] = [];
  private onDidUpdate = new vscode.EventEmitter<string>();
  readonly onUpdate = this.onDidUpdate.event;

  activate(context: vscode.ExtensionContext): void {
    const listener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme !== 'file') return;
      if (event.contentChanges.length === 0) return;

      const filePath = event.document.uri.fsPath;
      const now = performance.now();
      const lastTime = this.lastEditTime.get(filePath) ?? 0;
      const timeSinceLastEdit = lastTime > 0 ? now - lastTime : 10000;
      this.lastEditTime.set(filePath, now);

      const totalChars = event.contentChanges.reduce((s, c) => s + c.text.length, 0);

      for (const change of event.contentChanges) {
        const classification: Classification = classifyEdit({
          charsInserted: change.text.length,
          linesInserted: (change.text.match(/\n/g) || []).length,
          charsDeleted: change.rangeLength,
          timeSinceLastEdit,
          changeCount: event.contentChanges.length,
          totalCharsInAllChanges: totalChars,
        });

        const map = this.getOrCreateMap(filePath);
        const startLine = change.range.start.line;
        const linesDeleted = change.range.end.line - change.range.start.line;
        const newLines = change.text.split('\n');

        map.recordEdit(startLine, linesDeleted, newLines, classification);
      }

      this.onDidUpdate.fire(filePath);
    });

    this.disposables.push(listener);
    this.disposables.push(this.onDidUpdate);
    context.subscriptions.push(...this.disposables);
  }

  getOrCreateMap(filePath: string): AuthorshipMap {
    let map = this.authorshipMaps.get(filePath);
    if (!map) {
      map = new AuthorshipMap();
      this.authorshipMaps.set(filePath, map);
    }
    return map;
  }

  setMap(filePath: string, map: AuthorshipMap): void {
    this.authorshipMaps.set(filePath, map);
  }

  getMap(filePath: string): AuthorshipMap | undefined {
    return this.authorshipMaps.get(filePath);
  }

  getAllTrackedFiles(): string[] {
    return [...this.authorshipMaps.keys()];
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
