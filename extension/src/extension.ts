import * as vscode from 'vscode';
import { applyDecorations, clearDecorations } from './decorations';
import { SidebarProvider } from './sidebar';
import { CodeCrawlerDetector } from '../../src/analyzer/detector';
import type { AnalysisResult } from '../../src/analyzer/types';

let detector: CodeCrawlerDetector;
let sidebarProvider: SidebarProvider;
let lastResult: AnalysisResult | undefined;

export function activate(context: vscode.ExtensionContext): void {
  detector = new CodeCrawlerDetector();
  sidebarProvider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codeCrawler.sidebar', sidebarProvider),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeCrawler.analyzeFile', () => analyzeCurrentFile()),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeCrawler.analyzeWorkspace', () => analyzeWorkspace()),
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        analyzeEditor(editor);
      }
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const editor = vscode.window.visibleTextEditors.find((e) => e.document === doc);
      if (editor) {
        analyzeEditor(editor);
      }
    }),
  );

  if (vscode.window.activeTextEditor) {
    analyzeEditor(vscode.window.activeTextEditor);
  }
}

async function analyzeEditor(editor: vscode.TextEditor): Promise<void> {
  const doc = editor.document;
  try {
    const result = await detector.analyzeContent(
      doc.getText(),
      doc.fileName,
    );
    lastResult = result;
    applyDecorations(editor, result);
    sidebarProvider.updateResults(result);
  } catch {
    // Silently skip unsupported files
  }
}

async function analyzeCurrentFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active file to analyze.');
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Code Crawler: Analyzing...' },
    async () => {
      await analyzeEditor(editor);
      if (lastResult) {
        vscode.window.showInformationMessage(
          `Code Crawler: ${lastResult.summary.aiPercentage.toFixed(1)}% AI, ${lastResult.summary.humanPercentage.toFixed(1)}% Human`,
        );
      }
    },
  );
}

async function analyzeWorkspace(): Promise<void> {
  const files = await vscode.workspace.findFiles(
    '**/*.{js,ts,py,java,go,rs,c,cpp}',
    '**/node_modules/**',
    100,
  );

  if (files.length === 0) {
    vscode.window.showWarningMessage('No supported files found in workspace.');
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Code Crawler: Analyzing workspace...' },
    async (progress) => {
      const results: AnalysisResult[] = [];

      for (let i = 0; i < files.length; i++) {
        progress.report({ increment: (1 / files.length) * 100, message: files[i].fsPath });
        const doc = await vscode.workspace.openTextDocument(files[i]);
        try {
          const result = await detector.analyzeContent(doc.getText(), files[i].fsPath);
          results.push(result);
        } catch {
          // Skip unsupported files
        }
      }

      const totalLines = results.reduce((s, r) => s + r.summary.totalLines, 0);
      const aiLines = results.reduce((s, r) => s + r.summary.aiLines, 0);
      const aiPct = totalLines > 0 ? ((aiLines / totalLines) * 100).toFixed(1) : '0.0';

      vscode.window.showInformationMessage(
        `Code Crawler: ${results.length} files analyzed. ${aiPct}% AI-written overall.`,
      );
    },
  );
}

export function deactivate(): void {
  clearDecorations();
}
