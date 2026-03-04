export class CursorTracker {
  private cursorMoves: Array<{line: number, timestamp: number, isSelection: boolean}> = [];
  private editCount = 0;
  private readonly WINDOW = 200;

  recordCursorMove(line: number, timestamp: number, isSelection: boolean): void {
    this.cursorMoves.push({ line, timestamp, isSelection });
    if (this.cursorMoves.length > this.WINDOW) this.cursorMoves.shift();
  }

  recordEdit(): void { this.editCount++; }

  getScore(): number {
    if (this.editCount < 5) return 0.5;
    const ratio = this.cursorMoves.length / this.editCount;
    if (ratio > 2) return 0.1;
    if (ratio > 1) return 0.3;
    if (ratio < 0.5) return 0.85;
    return 0.5;
  }

  hadPreEditCursorMove(editLine: number, editTimestamp: number): boolean {
    return this.cursorMoves.some(
      m => m.timestamp > editTimestamp - 2000 &&
           m.timestamp < editTimestamp &&
           Math.abs(m.line - editLine) <= 2
    );
  }

  reset(): void { this.cursorMoves = []; this.editCount = 0; }
}
