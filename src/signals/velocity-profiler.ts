export class VelocityProfiler {
  private edits: Array<{timestamp: number, chars: number}> = [];

  recordEdit(timestamp: number, chars: number): void {
    this.edits.push({ timestamp, chars });
    const cutoff = timestamp - 600000;
    while (this.edits.length > 0 && this.edits[0].timestamp < cutoff) this.edits.shift();
  }

  getScore(): number {
    if (this.edits.length < 10) return 0.5;

    const windowMs = 60000;
    const windows: number[] = [];
    const now = this.edits[this.edits.length - 1].timestamp;

    for (let start = now - 300000; start < now; start += 30000) {
      const windowEdits = this.edits.filter(
        e => e.timestamp >= start && e.timestamp < start + windowMs
      );
      windows.push(windowEdits.reduce((s, e) => s + e.chars, 0));
    }

    if (windows.length < 2) return 0.5;

    const sorted = [...windows].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const maxWindow = Math.max(...windows);

    if (median > 0 && maxWindow / median > 5) return 0.8;
    if (median > 30 && maxWindow / median < 2) return 0.2;
    return 0.5;
  }

  reset(): void { this.edits = []; }
}
