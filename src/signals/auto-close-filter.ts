const AUTO_CLOSE_PAIRS: Record<string, string> = {
  '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`',
};

export class AutoCloseFilter {
  private lastOpenBracket: {char: string, timestamp: number, line: number} | null = null;

  isAutoClose(text: string, timestamp: number, line: number): boolean {
    if (this.lastOpenBracket &&
        text.length === 1 &&
        AUTO_CLOSE_PAIRS[this.lastOpenBracket.char] === text &&
        timestamp - this.lastOpenBracket.timestamp < 10 &&
        line === this.lastOpenBracket.line) {
      this.lastOpenBracket = null;
      return true;
    }

    if (text.length === 1 && text in AUTO_CLOSE_PAIRS) {
      this.lastOpenBracket = { char: text, timestamp, line };
    } else {
      this.lastOpenBracket = null;
    }

    return false;
  }

  isAutoIndent(text: string, timeSinceLastEdit: number): boolean {
    return /^\s+$/.test(text) && timeSinceLastEdit < 10;
  }

  reset(): void { this.lastOpenBracket = null; }
}
