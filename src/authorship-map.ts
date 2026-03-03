import type { LineAuthorship, FileAuthorship, AuthorshipSummary } from './types.js';
import type { Classification } from './classifier.js';

const HUMAN_EDIT_THRESHOLD = 5;

export class AuthorshipMap {
  private lines: Map<number, LineAuthorship> = new Map();

  recordEdit(
    startLine: number,
    linesDeleted: number,
    newLines: string[],
    classification: Classification,
  ): void {
    // Formatter and uncertain edits don't change authorship
    if (classification.type === 'formatter' || classification.type === 'uncertain') {
      return;
    }

    // Paste counts as human
    const editAuthor: 'ai' | 'human' =
      classification.type === 'ai' ? 'ai' : 'human';

    // Delete removed lines and shift subsequent lines
    if (linesDeleted > 0) {
      for (let i = startLine; i < startLine + linesDeleted; i++) {
        this.lines.delete(i);
      }
      this.shiftLines(startLine + linesDeleted, -linesDeleted);
    }

    // Insert new lines - shift existing lines up first
    const newLineCount = newLines.length;
    if (newLineCount > 1) {
      // Multi-line insert: shift lines after startLine up by (newLineCount - 1)
      this.shiftLines(startLine + (linesDeleted > 0 ? 0 : 1), newLineCount - 1);
    }

    const now = Date.now();

    // Apply authorship to affected lines
    for (let i = 0; i < newLineCount; i++) {
      const lineNum = startLine + i;
      const existing = this.lines.get(lineNum);

      if (existing && editAuthor === 'human' && (existing.author === 'ai' || existing.author === 'mixed')) {
        // Human editing an AI line - track edits toward reclassification
        existing.humanEdits++;
        existing.lastEditType = 'human';
        existing.lastEditTimestamp = now;
        if (existing.humanEdits >= HUMAN_EDIT_THRESHOLD) {
          existing.author = 'human';
          existing.confidence = 0.80;
        } else {
          existing.author = 'mixed';
        }
      } else if (existing && editAuthor === 'ai' && newLineCount === 1 && newLines[0].length <= 2) {
        // Small edit on existing line - keep existing authorship
      } else {
        // New line or overwriting
        this.lines.set(lineNum, {
          line: lineNum,
          author: editAuthor,
          confidence: classification.confidence,
          aiEdits: editAuthor === 'ai' ? (existing?.aiEdits ?? 0) + 1 : (existing?.aiEdits ?? 0),
          humanEdits: editAuthor === 'human' ? (existing?.humanEdits ?? 0) + 1 : (existing?.humanEdits ?? 0),
          lastEditType: editAuthor,
          lastEditTimestamp: now,
        });
      }
    }
  }

  shiftLines(fromLine: number, delta: number): void {
    if (delta === 0) return;

    const entries = [...this.lines.entries()]
      .filter(([line]) => line >= fromLine)
      .sort((a, b) => delta > 0 ? b[0] - a[0] : a[0] - b[0]);

    for (const [line, data] of entries) {
      this.lines.delete(line);
      const newLine = line + delta;
      if (newLine >= 0) {
        data.line = newLine;
        this.lines.set(newLine, data);
      }
    }
  }

  getLineAuthorship(line: number): LineAuthorship | undefined {
    return this.lines.get(line);
  }

  getSummary(): AuthorshipSummary {
    let aiLines = 0;
    let humanLines = 0;
    let mixedLines = 0;

    for (const data of this.lines.values()) {
      if (data.author === 'ai') aiLines++;
      else if (data.author === 'human') humanLines++;
      else mixedLines++;
    }

    const totalLines = this.lines.size;
    return {
      totalLines,
      aiLines,
      humanLines,
      mixedLines,
      aiPercentage: totalLines > 0 ? Math.round((aiLines / totalLines) * 100) : 0,
      humanPercentage: totalLines > 0 ? Math.round((humanLines / totalLines) * 100) : 0,
    };
  }

  getAllLines(): LineAuthorship[] {
    return [...this.lines.values()].sort((a, b) => a.line - b.line);
  }

  toJSON(): FileAuthorship {
    return {
      filePath: '',
      lines: this.getAllLines(),
      summary: this.getSummary(),
      lastUpdated: Date.now(),
    };
  }

  static fromJSON(data: FileAuthorship): AuthorshipMap {
    const map = new AuthorshipMap();
    for (const line of data.lines) {
      map.lines.set(line.line, { ...line });
    }
    return map;
  }
}
