import * as vscode from 'vscode';
import type { AuthorshipMap } from '../../src/authorship-map';

export class StatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'codeCrawler.showReport';
    this.item.show();
    this.update(undefined);
  }

  update(map: AuthorshipMap | undefined): void {
    if (!map) {
      this.item.text = '$(robot) AI: --% | $(person) Human: --%';
      this.item.tooltip = 'Code Crawler: No tracking data for this file';
      return;
    }

    const summary = map.getSummary();
    this.item.text = `$(robot) AI: ${summary.aiPercentage}% | $(person) Human: ${summary.humanPercentage}%`;
    this.item.tooltip = `Code Crawler: ${summary.totalLines} lines tracked (${summary.aiLines} AI, ${summary.humanLines} human, ${summary.mixedLines} mixed)`;
  }

  dispose(): void {
    this.item.dispose();
  }
}
