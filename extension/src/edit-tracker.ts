import * as vscode from 'vscode';
import { classifyEdit } from '../../src/classifier';
import { AuthorshipMap } from '../../src/authorship-map';
import { fuseSignals } from '../../src/confidence-engine';
import { KeystrokeDynamics } from '../../src/signals/keystroke-dynamics';
import { SequenceAnalyzer } from '../../src/signals/sequence-analyzer';
import { CursorTracker } from '../../src/signals/cursor-tracker';
import { UndoDetector } from '../../src/signals/undo-detector';
import { AutoCloseFilter } from '../../src/signals/auto-close-filter';
import { ExtensionDetector } from '../../src/signals/extension-detector';
import { VelocityProfiler } from '../../src/signals/velocity-profiler';
import { SelectionTracker } from '../../src/signals/selection-tracker';
import { PasteDetector } from '../../src/signals/paste-detector';
import { DeletionTracker } from '../../src/signals/deletion-tracker';
import { PauseAnalyzer } from '../../src/signals/pause-analyzer';
import type { Classification } from '../../src/classifier';
import type { SignalScores } from '../../src/types';

export class EditTracker {
  private lastEditTime: Map<string, number> = new Map();
  private authorshipMaps: Map<string, AuthorshipMap> = new Map();
  private disposables: vscode.Disposable[] = [];
  private onDidUpdate = new vscode.EventEmitter<string>();
  readonly onUpdate = this.onDidUpdate.event;

  // Signal trackers (all per-file)
  private keystrokeDynamics: Map<string, KeystrokeDynamics> = new Map();
  private sequenceAnalyzers: Map<string, SequenceAnalyzer> = new Map();
  private cursorTrackers: Map<string, CursorTracker> = new Map();
  private undoDetectors: Map<string, UndoDetector> = new Map();
  private autoCloseFilters: Map<string, AutoCloseFilter> = new Map();
  private extensionDetector = new ExtensionDetector();
  private velocityProfilers: Map<string, VelocityProfiler> = new Map();
  private selectionTrackers: Map<string, SelectionTracker> = new Map();
  private pasteDetectors: Map<string, PasteDetector> = new Map();
  private deletionTrackers: Map<string, DeletionTracker> = new Map();
  private pauseAnalyzers: Map<string, PauseAnalyzer> = new Map();

  private getSignalTracker<T>(map: Map<string, T>, filePath: string, ctor: new () => T): T {
    let tracker = map.get(filePath);
    if (!tracker) { tracker = new ctor(); map.set(filePath, tracker); }
    return tracker;
  }

  activate(context: vscode.ExtensionContext): void {
    // 1. Track text document changes
    const docListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme !== 'file') return;
      if (event.contentChanges.length === 0) return;

      const filePath = event.document.uri.fsPath;
      const now = performance.now();
      const lastTime = this.lastEditTime.get(filePath) ?? 0;
      const timeSinceLastEdit = lastTime > 0 ? now - lastTime : 10000;
      this.lastEditTime.set(filePath, now);

      const totalChars = event.contentChanges.reduce((s, c) => s + c.text.length, 0);
      const kd = this.getSignalTracker(this.keystrokeDynamics, filePath, KeystrokeDynamics);
      const sa = this.getSignalTracker(this.sequenceAnalyzers, filePath, SequenceAnalyzer);
      const ct = this.getSignalTracker(this.cursorTrackers, filePath, CursorTracker);
      const ud = this.getSignalTracker(this.undoDetectors, filePath, UndoDetector);
      const acf = this.getSignalTracker(this.autoCloseFilters, filePath, AutoCloseFilter);
      const vp = this.getSignalTracker(this.velocityProfilers, filePath, VelocityProfiler);
      const st = this.getSignalTracker(this.selectionTrackers, filePath, SelectionTracker);
      const pd = this.getSignalTracker(this.pasteDetectors, filePath, PasteDetector);
      const dt = this.getSignalTracker(this.deletionTrackers, filePath, DeletionTracker);
      const pa = this.getSignalTracker(this.pauseAnalyzers, filePath, PauseAnalyzer);

      for (const change of event.contentChanges) {
        // Filter auto-close brackets
        if (acf.isAutoClose(change.text, now, change.range.start.line)) continue;
        if (acf.isAutoIndent(change.text, timeSinceLastEdit)) continue;

        // Feed all signal trackers
        kd.recordEdit(now, change.text.length);
        sa.recordEdit(change.range.start.line, now);
        ct.recordEdit();
        ud.recordEdit(change.text, change.rangeLength, change.range.start.character, (event as any).reason);
        vp.recordEdit(now, change.text.length);
        pd.recordEdit(now, change.text.length, change.rangeLength, timeSinceLastEdit);
        dt.recordEdit(change.rangeLength);
        pa.recordEdit(now, change.text.length);

        // Base classification
        const baseClassification: Classification = classifyEdit({
          charsInserted: change.text.length,
          linesInserted: (change.text.match(/\n/g) || []).length,
          charsDeleted: change.rangeLength,
          timeSinceLastEdit,
          changeCount: event.contentChanges.length,
          totalCharsInAllChanges: totalChars,
        });

        // Gather signal scores
        const isReplace = change.rangeLength > 0 && change.text.length > 0;
        const signals: Partial<SignalScores> = {
          typingRhythm: (kd.getScore() + kd.getBurstScore()) / 2,
          editSize: baseClassification.type === 'ai' ? baseClassification.confidence :
                    baseClassification.type === 'human' ? 1 - baseClassification.confidence : 0.5,
          cursorMovement: ct.getScore(),
          editSequence: sa.getScore(),
          undoFrequency: ud.getScore(),
          extensionSource: this.extensionDetector.getScore(now),
          velocityProfile: vp.getScore(),
          selectionPattern: st.getScore(
            change.range.start.line, change.range.end.line, now, isReplace),
          pastePattern: pd.getScore(),
          deletionPattern: dt.getScore(),
          pausePattern: pa.getScore(),
        };

        // Fuse all signals
        const enhanced = fuseSignals(signals, baseClassification);

        // Update authorship map
        const map = this.getOrCreateMap(filePath);
        const startLine = change.range.start.line;
        const linesDeleted = change.range.end.line - change.range.start.line;
        const newLines = change.text.split('\n');
        map.recordEdit(startLine, linesDeleted, newLines, enhanced);
      }

      this.onDidUpdate.fire(filePath);
    });

    // 2. Track cursor/selection changes (per-file)
    const selectionListener = vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.document.uri.scheme !== 'file') return;
      const filePath = event.textEditor.document.uri.fsPath;
      const now = performance.now();
      const ct = this.getSignalTracker(this.cursorTrackers, filePath, CursorTracker);
      const st = this.getSignalTracker(this.selectionTrackers, filePath, SelectionTracker);
      for (const sel of event.selections) {
        ct.recordCursorMove(sel.active.line, now, !sel.isEmpty);
        if (!sel.isEmpty) {
          st.recordSelection(sel.start.line, sel.end.line, now);
        }
      }
    });

    // 3. Track extension command execution
    const commandListener = (vscode.commands as any).onDidExecuteCommand?.((e: any) => {
      const now = performance.now();
      const cmdId = typeof e === 'string' ? e : e?.command ?? '';
      // Try to extract extension ID from command
      const parts = cmdId.split('.');
      const extId = parts.length >= 2 ? parts.slice(0, 2).join('.') : cmdId;
      this.extensionDetector.recordCommand(extId, cmdId, now);
    });

    this.disposables.push(docListener, selectionListener, this.onDidUpdate);
    if (commandListener) this.disposables.push(commandListener);
    context.subscriptions.push(...this.disposables);
  }

  getOrCreateMap(filePath: string): AuthorshipMap {
    let map = this.authorshipMaps.get(filePath);
    if (!map) { map = new AuthorshipMap(); this.authorshipMaps.set(filePath, map); }
    return map;
  }

  setMap(filePath: string, map: AuthorshipMap): void { this.authorshipMaps.set(filePath, map); }
  getMap(filePath: string): AuthorshipMap | undefined { return this.authorshipMaps.get(filePath); }
  getAllTrackedFiles(): string[] { return [...this.authorshipMaps.keys()]; }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}
