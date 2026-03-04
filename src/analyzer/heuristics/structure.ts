import { Heuristic, LineScore, AnalysisContext } from '../types.js';

interface FunctionBlock {
  startLine: number;
  endLine: number;
  length: number;
  indentLevel: number;
}

function extractFunctions(lines: string[]): FunctionBlock[] {
  const blocks: FunctionBlock[] = [];
  const funcStartRe = /^(\s*)(?:export\s+)?(?:async\s+)?(?:function\b|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_$]\w*)\s*=>)/;

  for (let i = 0; i < lines.length; i++) {
    const match = funcStartRe.exec(lines[i]);
    if (!match) continue;

    const indent = match[1].length;
    let depth = 0;
    let end = i;

    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth <= 0 && j > i) {
        end = j;
        break;
      }
      if (j === lines.length - 1) end = j;
    }

    blocks.push({ startLine: i, endLine: end, length: end - i + 1, indentLevel: indent });
  }

  return blocks;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export const structureHeuristic: Heuristic = {
  name: 'structure',
  weight: 0.2,

  analyze(lines: string[], _context: AnalysisContext): LineScore[] {
    const functions = extractFunctions(lines);
    const baseScores = lines.map((content, i) => ({
      lineNumber: i + 1, content, aiProbability: 0.5, signals: [] as LineScore['signals'],
    }));

    if (functions.length < 2) return baseScores;

    // Measure uniformity: low std dev in function length = AI signal
    const lengths = functions.map(f => f.length);
    const stdDev = standardDeviation(lengths);
    const meanLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const cv = meanLen > 0 ? stdDev / meanLen : 0; // coefficient of variation

    // Low CV means functions are very similar in size = AI signal
    const uniformityScore = Math.max(0, Math.min(1, 1 - cv));

    // Measure indentation consistency across entire file
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    const indentSizes = nonEmptyLines
      .map(l => l.match(/^(\s*)/)?.[1].length ?? 0)
      .filter(n => n > 0);

    let indentScore = 0.5;
    if (indentSizes.length > 0) {
      // Check if all indents are multiples of the same base
      const minIndent = Math.min(...indentSizes);
      if (minIndent > 0) {
        const allMultiples = indentSizes.every(s => s % minIndent === 0);
        indentScore = allMultiples ? 0.7 : 0.3; // Perfect consistency = slight AI signal
      }
    }

    // Early-return pattern detection
    let earlyReturnCount = 0;
    let tryCatchCount = 0;
    for (const func of functions) {
      // Check first 3 lines of function body for guard clauses
      const bodyStart = func.startLine + 1;
      const bodyEnd = Math.min(bodyStart + 3, func.endLine);
      let hasEarlyReturn = false;
      for (let i = bodyStart; i < bodyEnd && i < lines.length; i++) {
        if (/^\s*if\s*\(/.test(lines[i])) {
          // Check this line and next for return/throw
          const nearby = lines.slice(i, Math.min(i + 2, lines.length)).join(' ');
          if (/\b(return|throw)\b/.test(nearby)) {
            hasEarlyReturn = true;
            break;
          }
        }
      }
      if (hasEarlyReturn) earlyReturnCount++;

      // Check for try/catch in function body
      const funcBody = lines.slice(func.startLine, func.endLine + 1).join('\n');
      if (/\btry\s*\{/.test(funcBody) && /\bcatch\s*\(/.test(funcBody)) {
        tryCatchCount++;
      }
    }

    let earlyReturnBonus = 0;
    if (functions.length > 0 && earlyReturnCount / functions.length > 0.7) {
      earlyReturnBonus = 0.1;
    }

    let tryCatchBonus = 0;
    if (functions.length > 0 && tryCatchCount / functions.length > 0.6) {
      tryCatchBonus = 0.1;
    }

    const combined = (uniformityScore * 0.6 + indentScore * 0.4) + earlyReturnBonus + tryCatchBonus;

    // Apply score to lines within functions
    for (const func of functions) {
      for (let i = func.startLine; i <= func.endLine && i < baseScores.length; i++) {
        baseScores[i].aiProbability = combined;
        if (combined > 0.6) {
          baseScores[i].signals.push({
            heuristic: 'structure',
            score: combined,
            reason: `Uniform function structure (CV=${cv.toFixed(2)})`,
          });
        }
      }
    }

    return baseScores;
  },
};
