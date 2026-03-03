import { describe, it, expect } from 'vitest';
import { generateFileReport, generateCommitReport } from '../src/reporter';
import type { FileAuthorship } from '../src/types';

function makeFakeFile(filePath: string, aiLines: number, humanLines: number, mixedLines = 0): FileAuthorship {
  const totalLines = aiLines + humanLines + mixedLines;
  return {
    filePath,
    lines: [],
    summary: {
      totalLines,
      aiLines,
      humanLines,
      mixedLines,
      aiPercentage: totalLines > 0 ? Math.round((aiLines / totalLines) * 100) : 0,
      humanPercentage: totalLines > 0 ? Math.round((humanLines / totalLines) * 100) : 0,
    },
    lastUpdated: Date.now(),
  };
}

describe('generateFileReport', () => {
  it('generates markdown report for a file', () => {
    const file = makeFakeFile('src/index.ts', 40, 55, 5);
    const report = generateFileReport(file);
    expect(report).toContain('src/index.ts');
    expect(report).toContain('40%');
    expect(report).toContain('55%');
    expect(report).toContain('5 lines');
  });
});

describe('generateCommitReport', () => {
  it('generates table report for multiple files', () => {
    const files = [
      makeFakeFile('src/a.ts', 10, 90),
      makeFakeFile('src/b.ts', 50, 50),
    ];
    const report = generateCommitReport(files);
    expect(report).toContain('Code Crawler Report');
    expect(report).toContain('src/a.ts');
    expect(report).toContain('src/b.ts');
    expect(report).toContain('|');
  });

  it('handles empty file list', () => {
    const report = generateCommitReport([]);
    expect(report).toContain('No authorship data found');
  });

  it('computes overall stats across files', () => {
    const files = [
      makeFakeFile('a.ts', 10, 10),
      makeFakeFile('b.ts', 10, 10),
    ];
    const report = generateCommitReport(files);
    expect(report).toContain('50% AI');
    expect(report).toContain('50% Human');
    expect(report).toContain('40 lines');
  });
});
