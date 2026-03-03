import type { FileAuthorship, AuthorshipSummary } from './types.js';

export function generateFileReport(authorship: FileAuthorship): string {
  const { summary } = authorship;
  const lines = [
    `# ${authorship.filePath}`,
    '',
    `- **AI-written:** ${summary.aiPercentage}% (${summary.aiLines} lines)`,
    `- **Human-written:** ${summary.humanPercentage}% (${summary.humanLines} lines)`,
    `- **Mixed:** ${summary.mixedLines} lines`,
    `- **Total:** ${summary.totalLines} lines`,
  ];
  return lines.join('\n');
}

export function generateCommitReport(files: FileAuthorship[]): string {
  if (files.length === 0) return 'No authorship data found.';

  const rows = files.map((f) => {
    const s = f.summary;
    return `| \`${f.filePath}\` | ${s.aiPercentage}% | ${s.humanPercentage}% | ${s.totalLines} |`;
  });

  const overall = computeOverallSummary(files);

  const lines = [
    '## Code Crawler Report',
    '',
    '| File | AI % | Human % | Lines |',
    '|------|------|---------|-------|',
    ...rows,
    '',
    `**Overall: ${overall.aiPercentage}% AI, ${overall.humanPercentage}% Human** (${files.length} files, ${overall.totalLines} lines)`,
  ];

  return lines.join('\n');
}

function computeOverallSummary(files: FileAuthorship[]): AuthorshipSummary {
  let totalLines = 0, aiLines = 0, humanLines = 0, mixedLines = 0;
  for (const f of files) {
    totalLines += f.summary.totalLines;
    aiLines += f.summary.aiLines;
    humanLines += f.summary.humanLines;
    mixedLines += f.summary.mixedLines;
  }
  return {
    totalLines,
    aiLines,
    humanLines,
    mixedLines,
    aiPercentage: totalLines > 0 ? Math.round((aiLines / totalLines) * 100) : 0,
    humanPercentage: totalLines > 0 ? Math.round((humanLines / totalLines) * 100) : 0,
  };
}
