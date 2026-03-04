export class UndoDetector {
  private recentEdits: Array<{text: string, rangeLength: number, offset: number}> = [];
  private undoCount = 0;
  private totalEdits = 0;

  recordEdit(text: string, rangeLength: number, offset: number, reason?: number): void {
    this.totalEdits++;

    if (reason === 1) { this.undoCount++; return; }
    if (reason === 2) return;

    // Heuristic: current edit reverses previous
    if (this.recentEdits.length > 0) {
      const prev = this.recentEdits[this.recentEdits.length - 1];
      if (rangeLength > 0 && text.length === 0 &&
          offset === prev.offset && rangeLength === prev.text.length) {
        this.undoCount++;
      }
    }

    this.recentEdits.push({ text, rangeLength, offset });
    if (this.recentEdits.length > 20) this.recentEdits.shift();
  }

  getScore(): number {
    if (this.totalEdits < 20) return 0.5;
    const undoRate = this.undoCount / this.totalEdits;
    if (undoRate > 0.03) return 0.1; // humans undo
    if (undoRate === 0 && this.totalEdits > 50) return 0.8; // AI never undoes
    return 0.5;
  }

  getUndoCount(): number { return this.undoCount; }
  getTotalEdits(): number { return this.totalEdits; }
  reset(): void { this.recentEdits = []; this.undoCount = 0; this.totalEdits = 0; }
}
