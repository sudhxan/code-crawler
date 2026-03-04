export class SelectionTracker {
  private recentSelections: Array<{startLine: number, endLine: number, timestamp: number}> = [];

  recordSelection(startLine: number, endLine: number, timestamp: number): void {
    if (startLine !== endLine) {
      this.recentSelections.push({ startLine, endLine, timestamp });
      if (this.recentSelections.length > 50) this.recentSelections.shift();
    }
  }

  hadSelectionBeforeReplace(
    editStartLine: number, editEndLine: number, editTimestamp: number
  ): boolean {
    return this.recentSelections.some(s =>
      Math.abs(s.startLine - editStartLine) <= 1 &&
      Math.abs(s.endLine - editEndLine) <= 1 &&
      s.timestamp > editTimestamp - 3000 &&
      s.timestamp < editTimestamp
    );
  }

  getScore(editStartLine: number, editEndLine: number, editTimestamp: number, isReplace: boolean): number {
    if (!isReplace) return 0.5;
    return this.hadSelectionBeforeReplace(editStartLine, editEndLine, editTimestamp) ? 0.15 : 0.7;
  }

  reset(): void { this.recentSelections = []; }
}
