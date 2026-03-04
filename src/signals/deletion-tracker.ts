export class DeletionTracker {
  private deletions: number[] = [];

  recordEdit(charsDeleted: number): void {
    if (charsDeleted > 0) {
      this.deletions.push(charsDeleted);
    }
  }

  getScore(): number {
    if (this.deletions.length < 10) return 0.5;

    const smallDeletions = this.deletions.filter(d => d <= 3).length;
    const largeDeletions = this.deletions.filter(d => d > 20).length;
    const total = this.deletions.length;

    if (smallDeletions / total > 0.7) return 0.15;
    if (largeDeletions / total > 0.5) return 0.80;
    return 0.5;
  }

  reset(): void {
    this.deletions = [];
  }
}
