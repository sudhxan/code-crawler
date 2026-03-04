export class SequenceAnalyzer {
  private editPositions: Array<{line: number, timestamp: number}> = [];
  private readonly WINDOW = 100;

  recordEdit(line: number, timestamp: number): void {
    this.editPositions.push({ line, timestamp });
    if (this.editPositions.length > this.WINDOW) this.editPositions.shift();
  }

  getDirectionalityScore(): number {
    if (this.editPositions.length < 5) return 0.5;

    let monotonic = 0;
    let jumps = 0;

    for (let i = 1; i < this.editPositions.length; i++) {
      const diff = this.editPositions[i].line - this.editPositions[i-1].line;
      if (diff >= 0 && diff <= 5) monotonic++;
      if (Math.abs(diff) > 10) jumps++;
    }

    const total = this.editPositions.length - 1;
    const monotonicRatio = monotonic / total;
    const jumpRatio = jumps / total;

    if (jumpRatio > 0.3) return 0.1;
    if (monotonicRatio > 0.8) return 0.85;

    // Linear interpolation
    return Math.max(0, Math.min(1, 0.5 - jumpRatio * 0.8 + monotonicRatio * 0.4));
  }

  getLocalityScore(): number {
    if (this.editPositions.length < 10) return 0.5;

    const recent = this.editPositions.slice(-20);
    const regions = new Set(recent.map(e => Math.floor(e.line / 10))).size;

    if (regions >= 5) return 0.15;
    if (regions <= 1) return 0.8;
    return 0.5 - (regions - 1) * 0.1;
  }

  getScore(): number {
    const dir = this.getDirectionalityScore();
    const loc = this.getLocalityScore();
    return dir * 0.6 + loc * 0.4;
  }

  reset(): void { this.editPositions = []; }
}
