export class KeystrokeDynamics {
  private recentEdits: Array<{timestamp: number, chars: number}> = [];
  private readonly WINDOW_SIZE = 50;

  recordEdit(timestamp: number, charsInserted: number): void {
    this.recentEdits.push({ timestamp, chars: charsInserted });
    if (this.recentEdits.length > this.WINDOW_SIZE) this.recentEdits.shift();
  }

  getScore(): number {
    if (this.recentEdits.length < 5) return 0.5;

    const singleCharEdits = this.recentEdits.filter(e => e.chars === 1);
    if (singleCharEdits.length < 3) {
      // Very few single-char edits = AI pattern
      const ratio = singleCharEdits.length / this.recentEdits.length;
      return ratio < 0.2 ? 0.85 : 0.5;
    }

    const intervals: number[] = [];
    for (let i = 1; i < singleCharEdits.length; i++) {
      const gap = singleCharEdits[i].timestamp - singleCharEdits[i-1].timestamp;
      if (gap < 5000) intervals.push(gap); // filter out long pauses between sessions
    }

    if (intervals.length < 2) return 0.5;

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;

    // Human CV: 0.3-0.8. AI: near 0 (or no single-char edits)
    if (cv > 0.3) return 0.1;
    if (cv > 0.15) return 0.3;
    if (cv < 0.05 && intervals.length > 5) return 0.9;
    return 0.5;
  }

  getBurstScore(): number {
    if (this.recentEdits.length < 10) return 0.5;

    let bursts = 0;
    let inBurst = false;

    for (let i = 1; i < this.recentEdits.length; i++) {
      const gap = this.recentEdits[i].timestamp - this.recentEdits[i-1].timestamp;
      if (gap < 500 && !inBurst) { inBurst = true; bursts++; }
      if (gap > 2000) inBurst = false;
    }

    if (bursts >= 3) return 0.15;
    if (bursts === 0 && this.recentEdits.length >= 10) return 0.85;
    return 0.5;
  }

  reset(): void { this.recentEdits = []; }
}
