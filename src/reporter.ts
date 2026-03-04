import type { FileAuthorship, AuthorshipSummary, SignalScores } from './types.js';

export function generateFileReport(authorship: FileAuthorship): string {
  const { summary } = authorship;
  const dominant = getDominantSignal(authorship);
  const reliability = getReliabilityScore(authorship);
  const confidenceDist = getConfidenceDistribution(authorship);
  const signalBreakdown = getSignalBreakdown(authorship);

  const lines = [
    `# ${authorship.filePath}`,
    '',
    `- **AI-written:** ${summary.aiPercentage}% (${summary.aiLines} lines)`,
    `- **Human-written:** ${summary.humanPercentage}% (${summary.humanLines} lines)`,
    `- **Mixed:** ${summary.mixedLines} lines`,
    `- **Total:** ${summary.totalLines} lines`,
    ...(dominant ? [`- **Dominant signal:** ${dominant}`] : []),
    `- **Detection reliability:** ${reliability}`,
    '',
    '### Confidence Distribution',
    `- High (>0.8): ${confidenceDist.high} lines`,
    `- Medium (0.5-0.8): ${confidenceDist.medium} lines`,
    `- Low (<0.5): ${confidenceDist.low} lines`,
  ];

  if (signalBreakdown.length > 0) {
    lines.push('', '### Signal Contributions');
    for (const s of signalBreakdown) {
      lines.push(`- **${s.signal}:** ${s.direction} (${s.count} lines affected, avg deviation ${s.avgDeviation.toFixed(2)})`);
    }
  }

  return lines.join('\n');
}

export function generateCommitReport(files: FileAuthorship[]): string {
  if (files.length === 0) return 'No authorship data found.';

  const rows = files.map((f) => {
    const s = f.summary;
    const dominant = getDominantSignal(f) || '-';
    const reliability = getReliabilityScore(f);
    return `| \`${f.filePath}\` | ${s.aiPercentage}% | ${s.humanPercentage}% | ${s.totalLines} | ${dominant} | ${reliability} |`;
  });

  const overall = computeOverallSummary(files);

  const lines = [
    '## Code Crawler Report',
    '',
    '| File | AI % | Human % | Lines | Dominant Signal | Reliability |',
    '|------|------|---------|-------|-----------------|-------------|',
    ...rows,
    '',
    `**Overall: ${overall.aiPercentage}% AI, ${overall.humanPercentage}% Human** (${files.length} files, ${overall.totalLines} lines)`,
  ];

  return lines.join('\n');
}

function getDominantSignal(file: FileAuthorship): string | null {
  const signalCounts: Record<string, number> = {};
  for (const line of file.lines) {
    if (!line.signals) continue;
    let best = '';
    let maxDev = 0;
    for (const [key, val] of Object.entries(line.signals)) {
      const dev = Math.abs(val - 0.5);
      if (dev > maxDev) { maxDev = dev; best = key; }
    }
    if (best) signalCounts[best] = (signalCounts[best] || 0) + 1;
  }

  let dominant: string | null = null;
  let maxCount = 0;
  for (const [signal, count] of Object.entries(signalCounts)) {
    if (count > maxCount) { maxCount = count; dominant = signal; }
  }
  return dominant;
}

function getReliabilityScore(file: FileAuthorship): string {
  if (file.lines.length === 0) return 'none';
  const withSignals = file.lines.filter(l => l.signals && Object.values(l.signals).some(v => Math.abs(v - 0.5) > 0.01));
  const ratio = withSignals.length / file.lines.length;
  if (ratio > 0.8) return 'high';
  if (ratio > 0.4) return 'medium';
  if (ratio > 0) return 'low';
  return 'none';
}

function getConfidenceDistribution(file: FileAuthorship): { high: number; medium: number; low: number } {
  let high = 0, medium = 0, low = 0;
  for (const line of file.lines) {
    if (line.confidence > 0.8) high++;
    else if (line.confidence >= 0.5) medium++;
    else low++;
  }
  return { high, medium, low };
}

interface SignalSummary {
  signal: string;
  direction: 'AI' | 'Human' | 'Neutral';
  count: number;
  avgDeviation: number;
}

function getSignalBreakdown(file: FileAuthorship): SignalSummary[] {
  const signalData: Record<string, { totalDev: number; count: number; aiCount: number; humanCount: number }> = {};

  for (const line of file.lines) {
    if (!line.signals) continue;
    for (const [key, val] of Object.entries(line.signals) as [keyof SignalScores, number][]) {
      const dev = Math.abs(val - 0.5);
      if (dev <= 0.01) continue;
      if (!signalData[key]) signalData[key] = { totalDev: 0, count: 0, aiCount: 0, humanCount: 0 };
      signalData[key].totalDev += dev;
      signalData[key].count++;
      if (val > 0.5) signalData[key].aiCount++;
      else signalData[key].humanCount++;
    }
  }

  return Object.entries(signalData)
    .map(([signal, data]) => ({
      signal,
      direction: (data.aiCount > data.humanCount ? 'AI' : data.humanCount > data.aiCount ? 'Human' : 'Neutral') as SignalSummary['direction'],
      count: data.count,
      avgDeviation: data.totalDev / data.count,
    }))
    .sort((a, b) => b.avgDeviation - a.avgDeviation);
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
