import * as vscode from 'vscode';
import type { AnalysisResult } from '../../src/analyzer/types';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _result?: AnalysisResult;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    this._render();
  }

  updateResults(result: AnalysisResult): void {
    this._result = result;
    this._render();
  }

  private _render(): void {
    if (!this._view) return;

    const r = this._result;
    const aiPct = r ? r.summary.aiPercentage.toFixed(1) : '0.0';
    const humanPct = r ? r.summary.humanPercentage.toFixed(1) : '0.0';
    const confidence = r ? (r.summary.confidence * 100).toFixed(0) : '0';
    const fileName = r ? r.filePath.split('/').pop() || r.filePath : 'No file';
    const totalLines = r ? r.summary.totalLines : 0;
    const aiLines = r ? r.summary.aiLines : 0;
    const humanLines = r ? r.summary.humanLines : 0;

    this._view.webview.html = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; margin: 0; }
  h3 { margin: 0 0 8px; font-size: 13px; opacity: 0.8; }
  .file { font-size: 12px; opacity: 0.6; margin-bottom: 16px; word-break: break-all; }
  .chart { display: flex; justify-content: center; margin: 16px 0; }
  .pie { width: 120px; height: 120px; border-radius: 50%; position: relative; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat { background: var(--vscode-editor-background); border-radius: 6px; padding: 10px; text-align: center; }
  .stat-value { font-size: 20px; font-weight: bold; }
  .stat-label { font-size: 11px; opacity: 0.6; margin-top: 2px; }
  .ai { color: #f06060; }
  .human { color: #60c060; }
  .confidence { text-align: center; margin-top: 12px; font-size: 12px; opacity: 0.7; }
</style>
</head>
<body>
  <h3>Code Crawler</h3>
  <div class="file">${fileName}</div>
  <div class="chart">
    <div class="pie" style="background: conic-gradient(#f06060 0% ${aiPct}%, #60c060 ${aiPct}% 100%);"></div>
  </div>
  <div class="stats">
    <div class="stat">
      <div class="stat-value ai">${aiPct}%</div>
      <div class="stat-label">AI (${aiLines} lines)</div>
    </div>
    <div class="stat">
      <div class="stat-value human">${humanPct}%</div>
      <div class="stat-label">Human (${humanLines} lines)</div>
    </div>
  </div>
  <div class="confidence">Confidence: ${confidence}% &middot; ${totalLines} lines</div>
</body>
</html>`;
  }
}
