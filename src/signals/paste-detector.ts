export class PasteDetector {
  private edits: Array<{timestamp: number, charsInserted: number, charsDeleted: number, timeSinceLastEdit: number}> = [];
  private recentSingleCharTimestamps: number[] = [];

  recordEdit(timestamp: number, charsInserted: number, charsDeleted: number, timeSinceLastEdit: number): void {
    this.edits.push({ timestamp, charsInserted, charsDeleted, timeSinceLastEdit });
    if (charsInserted === 1) {
      this.recentSingleCharTimestamps.push(timestamp);
      // Keep only last 2 seconds worth
      const cutoff = timestamp - 2000;
      this.recentSingleCharTimestamps = this.recentSingleCharTimestamps.filter(t => t >= cutoff);
    }
  }

  private isPaste(edit: {charsInserted: number, timeSinceLastEdit: number, timestamp: number}): boolean {
    if (edit.charsInserted <= 50) return false;
    // Fast insertion after previous edit
    if (edit.timeSinceLastEdit < 100) return true;
    // No preceding single-char edits in last 2s
    const cutoff = edit.timestamp - 2000;
    const recentTyping = this.recentSingleCharTimestamps.filter(t => t >= cutoff && t < edit.timestamp);
    return recentTyping.length === 0;
  }

  getScore(): number {
    if (this.edits.length < 10) return 0.5;

    let pasteEvents = 0;
    for (const edit of this.edits) {
      if (this.isPaste(edit)) pasteEvents++;
    }

    const pasteRatio = pasteEvents / this.edits.length;
    if (pasteRatio > 0.5) return 0.85;
    if (pasteRatio > 0.3) return 0.70;
    if (pasteRatio < 0.1) return 0.20;
    return 0.5;
  }

  reset(): void {
    this.edits = [];
    this.recentSingleCharTimestamps = [];
  }
}
