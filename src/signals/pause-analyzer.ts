export class PauseAnalyzer {
  private lastTimestamp: number | null = null;
  private pauseEvents: Array<{pauseDuration: number, charsInserted: number}> = [];

  recordEdit(timestamp: number, charsInserted: number): void {
    if (this.lastTimestamp !== null) {
      const gap = timestamp - this.lastTimestamp;
      if (gap > 2000) {
        this.pauseEvents.push({ pauseDuration: gap, charsInserted });
      }
    }
    this.lastTimestamp = timestamp;
  }

  getScore(): number {
    if (this.pauseEvents.length < 5) return 0.5;

    let humanPatterns = 0;
    let aiPatterns = 0;

    for (const event of this.pauseEvents) {
      if (event.pauseDuration >= 2000 && event.pauseDuration <= 30000 && event.charsInserted < 20) {
        humanPatterns++;
      }
      if (event.pauseDuration > 10000 && event.charsInserted > 100) {
        aiPatterns++;
      }
    }

    const total = this.pauseEvents.length;
    const aiPauseRatio = aiPatterns / total;
    const humanPauseRatio = humanPatterns / total;

    if (aiPauseRatio > 0.5) return 0.80;
    if (humanPauseRatio > 0.6) return 0.15;
    return 0.5;
  }

  reset(): void {
    this.lastTimestamp = null;
    this.pauseEvents = [];
  }
}
