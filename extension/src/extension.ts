import * as vscode from 'vscode';
import { EditTracker } from './edit-tracker';
import { StatusBar } from './status-bar';
import { applyDecorations, clearDecorations, disposeDecorations } from './decorations';
import { SidebarProvider } from './sidebar';
import { saveFileAuthorship, loadFileAuthorship } from '../../src/persistence';
import { generateCommitReport } from '../../src/reporter';
import { loadAllAuthorship } from '../../src/persistence';

let editTracker: EditTracker;
let statusBar: StatusBar;
let sidebarProvider: SidebarProvider;

function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function activate(context: vscode.ExtensionContext): void {
  editTracker = new EditTracker();
  statusBar = new StatusBar();
  sidebarProvider = new SidebarProvider(context.extensionUri);

  // Load persisted authorship data for open files
  const root = getWorkspaceRoot();
  if (root) {
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme === 'file') {
        const map = loadFileAuthorship(root, doc.uri.fsPath);
        if (map) {
          editTracker.setMap(doc.uri.fsPath, map);
        }
      }
    }
  }

  editTracker.activate(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codeCrawler.sidebar', sidebarProvider),
  );

  // Update decorations and status bar on edit
  let updateTimeout: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    editTracker.onUpdate((filePath) => {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.uri.fsPath === filePath) {
          const map = editTracker.getMap(filePath);
          if (map) {
            applyDecorations(editor, map);
            statusBar.update(map);
          }
        }
      }, 200);
    }),
  );

  // Update on active editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.uri.scheme === 'file') {
        const map = editTracker.getMap(editor.document.uri.fsPath);
        if (map) {
          applyDecorations(editor, map);
          statusBar.update(map);
        } else {
          clearDecorations(editor);
          statusBar.update(undefined);
        }
      }
    }),
  );

  // Save authorship on file save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const wsRoot = getWorkspaceRoot();
      if (!wsRoot || doc.uri.scheme !== 'file') return;
      const map = editTracker.getMap(doc.uri.fsPath);
      if (map) {
        saveFileAuthorship(wsRoot, doc.uri.fsPath, map);
      }
    }),
  );

  // Show Report command
  context.subscriptions.push(
    vscode.commands.registerCommand('codeCrawler.showReport', () => {
      const wsRoot = getWorkspaceRoot();
      if (!wsRoot) {
        vscode.window.showWarningMessage('No workspace open.');
        return;
      }
      const files = loadAllAuthorship(wsRoot);
      if (files.length === 0) {
        vscode.window.showInformationMessage('No authorship data yet. Start editing to track.');
        return;
      }
      const report = generateCommitReport(files);
      const doc = vscode.workspace.openTextDocument({ content: report, language: 'markdown' });
      doc.then((d) => vscode.window.showTextDocument(d));
    }),
  );

  // Reset Tracking command
  context.subscriptions.push(
    vscode.commands.registerCommand('codeCrawler.resetTracking', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Reset all Code Crawler tracking data?',
        { modal: true },
        'Reset',
      );
      if (confirm === 'Reset') {
        for (const filePath of editTracker.getAllTrackedFiles()) {
          editTracker.setMap(filePath, new (await import('../../src/authorship-map')).AuthorshipMap());
        }
        const editor = vscode.window.activeTextEditor;
        if (editor) clearDecorations(editor);
        statusBar.update(undefined);
        vscode.window.showInformationMessage('Code Crawler tracking data reset.');
      }
    }),
  );

  // Apply decorations on initial active editor
  if (vscode.window.activeTextEditor) {
    const editor = vscode.window.activeTextEditor;
    const map = editTracker.getMap(editor.document.uri.fsPath);
    if (map) {
      applyDecorations(editor, map);
      statusBar.update(map);
    }
  }

  context.subscriptions.push(statusBar);
}

export function deactivate(): void {
  // Save all tracked files on deactivation
  const root = getWorkspaceRoot();
  if (root) {
    for (const filePath of editTracker.getAllTrackedFiles()) {
      const map = editTracker.getMap(filePath);
      if (map) {
        saveFileAuthorship(root, filePath, map);
      }
    }
  }

  disposeDecorations();
  editTracker.dispose();
}
