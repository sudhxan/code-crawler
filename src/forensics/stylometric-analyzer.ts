import { ForensicSignal, StyleFeatures } from './types.js';

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'class', 'import', 'export', 'from', 'new', 'this', 'true', 'false', 'null',
  'undefined', 'typeof', 'instanceof', 'void', 'async', 'await', 'try', 'catch',
  'throw', 'switch', 'case', 'break', 'continue', 'default', 'interface', 'type',
  'enum', 'extends', 'implements',
]);

function extractIdentifiers(code: string): string[] {
  const stripped = code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '');

  const matches = stripped.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
  return matches.filter(id => !KEYWORDS.has(id) && id.length > 1);
}

function classifyNaming(id: string): 'camelCase' | 'snake_case' | 'other' {
  if (/^[a-z][a-zA-Z0-9]*$/.test(id) && /[A-Z]/.test(id)) return 'camelCase';
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(id)) return 'snake_case';
  return 'other';
}

function countCommentLines(code: string): number {
  let count = 0;
  let inBlock = false;
  for (const line of code.split('\n')) {
    const trimmed = line.trim();
    if (inBlock) {
      count++;
      if (trimmed.includes('*/')) inBlock = false;
    } else if (trimmed.startsWith('//')) {
      count++;
    } else if (trimmed.startsWith('/*')) {
      count++;
      if (!trimmed.includes('*/')) inBlock = true;
    }
  }
  return count;
}

function getCommentTexts(code: string): string[] {
  const comments: string[] = [];
  const singleLine = code.match(/\/\/\s*(.*)/g) || [];
  singleLine.forEach(c => comments.push(c.replace(/^\/\/\s*/, '')));
  const multiLine = code.match(/\/\*[\s\S]*?\*\//g) || [];
  multiLine.forEach(c => comments.push(c.replace(/^\/\*\s*|\s*\*\/$/g, '')));
  return comments;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map(v => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function extractStyleFeatures(code: string, _language?: string): StyleFeatures {
  const identifiers = extractIdentifiers(code);
  const avgIdentifierLength = identifiers.length > 0
    ? identifiers.reduce((sum, id) => sum + id.length, 0) / identifiers.length
    : 0;

  const classified = identifiers.map(classifyNaming);
  const camelCount = classified.filter(c => c === 'camelCase').length;
  const snakeCount = classified.filter(c => c === 'snake_case').length;
  const classifiable = camelCount + snakeCount;
  const identifierConsistency = classifiable > 0
    ? Math.max(camelCount, snakeCount) / classifiable
    : 1.0;

  const nonEmptyLines = code.split('\n').filter(l => l.trim().length > 0);
  const totalNonEmpty = nonEmptyLines.length || 1;
  const commentLines = countCommentLines(code);
  const commentDensity = commentLines / totalNonEmpty;

  const commentTexts = getCommentTexts(code);
  let commentStyle: 'descriptive' | 'terse' | 'mixed' | 'none' = 'none';
  if (commentTexts.length > 0) {
    const descriptiveCount = commentTexts.filter(c => c.length > 30 && /\s/.test(c)).length;
    const terseCount = commentTexts.filter(c => c.length <= 30).length;
    const ratio = descriptiveCount / commentTexts.length;
    if (ratio > 0.6) commentStyle = 'descriptive';
    else if (terseCount / commentTexts.length > 0.6) commentStyle = 'terse';
    else commentStyle = 'mixed';
  }

  const lineLengths = nonEmptyLines.map(l => l.length);
  const avgLineLength = lineLengths.reduce((a, b) => a + b, 0) / (lineLengths.length || 1);
  const lineVariance = stddev(lineLengths);

  const indentedLines = code.split('\n').filter(l => /^\s+\S/.test(l));
  const tabCount = indentedLines.filter(l => l.startsWith('\t')).length;
  const spaceCount = indentedLines.length - tabCount;
  const dominant = Math.max(tabCount, spaceCount);
  const wsConsistencyScore = indentedLines.length > 0 ? dominant / indentedLines.length : 1.0;
  const whitespaceStyle: 'consistent' | 'varied' = wsConsistencyScore > 0.9 ? 'consistent' : 'varied';

  const tokens = code.split(/[\s\W]+/).filter(t => t.length > 0);
  const uniqueTokens = new Set(tokens);
  const vocabularyRichness = tokens.length > 0 ? uniqueTokens.size / tokens.length : 0;

  return {
    avgIdentifierLength,
    identifierConsistency,
    commentDensity,
    commentStyle,
    avgLineLength,
    lineVariance,
    whitespaceStyle,
    vocabularyRichness,
  };
}

export function analyzeStyleSignals(features: StyleFeatures, code: string): ForensicSignal[] {
  const signals: ForensicSignal[] = [];

  // 1. Naming consistency
  {
    let score: number;
    const evidence: string[] = [];
    if (features.identifierConsistency > 0.95) {
      score = 0.8;
      evidence.push(`Near-perfect naming consistency: ${features.identifierConsistency.toFixed(2)}`);
    } else if (features.identifierConsistency >= 0.6 && features.identifierConsistency <= 0.85) {
      score = 0.2;
      evidence.push(`Moderate naming consistency: ${features.identifierConsistency.toFixed(2)}`);
    } else {
      score = 0.3;
      evidence.push(`Mixed naming: ${features.identifierConsistency.toFixed(2)}`);
    }
    signals.push({ name: 'namingConsistency', score, confidence: 0.6, evidence });
  }

  // 2. Comment pattern
  {
    let score: number;
    const evidence: string[] = [];
    if (features.commentStyle === 'descriptive' && features.commentDensity > 0.15) {
      score = 0.75;
      evidence.push(`High comment density (${features.commentDensity.toFixed(2)}) with descriptive style`);
    } else if (features.commentStyle === 'none' || features.commentDensity < 0.02) {
      score = 0.6;
      evidence.push('No comments or negligible comment density');
    } else if (features.commentStyle === 'terse' && features.commentDensity <= 0.15) {
      score = 0.2;
      evidence.push(`Terse, sparse comments (density: ${features.commentDensity.toFixed(2)})`);
    } else {
      score = 0.4;
      evidence.push(`Mixed comment pattern (style: ${features.commentStyle}, density: ${features.commentDensity.toFixed(2)})`);
    }
    signals.push({ name: 'commentPattern', score, confidence: 0.5, evidence });
  }

  // 3. Code homogeneity
  {
    let score: number;
    const evidence: string[] = [];
    if (features.lineVariance < 8 && features.whitespaceStyle === 'consistent') {
      score = 0.8;
      evidence.push(`Low line length variance (${features.lineVariance.toFixed(1)}) with consistent whitespace`);
    } else if (features.lineVariance > 15 && features.whitespaceStyle === 'varied') {
      score = 0.2;
      evidence.push(`High line length variance (${features.lineVariance.toFixed(1)}) with varied whitespace`);
    } else {
      score = 0.5;
      evidence.push(`Moderate homogeneity (variance: ${features.lineVariance.toFixed(1)}, whitespace: ${features.whitespaceStyle})`);
    }
    signals.push({ name: 'codeHomogeneity', score, confidence: 0.55, evidence });
  }

  // 4. Vocabulary pattern
  {
    let score: number;
    const evidence: string[] = [];
    if (features.vocabularyRichness >= 0.3 && features.vocabularyRichness <= 0.5) {
      score = 0.7;
      evidence.push(`Moderate vocabulary richness (${features.vocabularyRichness.toFixed(2)})`);
    } else if (features.vocabularyRichness > 0.6 || features.vocabularyRichness < 0.2) {
      score = 0.3;
      evidence.push(`Unusual vocabulary richness (${features.vocabularyRichness.toFixed(2)})`);
    } else {
      score = 0.5;
      evidence.push(`Vocabulary richness: ${features.vocabularyRichness.toFixed(2)}`);
    }
    signals.push({ name: 'vocabularyPattern', score, confidence: 0.4, evidence });
  }

  return signals;
}
