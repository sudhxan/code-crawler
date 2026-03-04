import { Heuristic, LineScore, AnalysisContext } from '../types.js';

interface FunctionInfo {
  startLine: number;
  endLine: number;
  params: string[];
  hasTryCatch: boolean;
  hasParamValidation: boolean;
  hasJSDoc: boolean;
  jsdocParamsMatch: boolean;
}

const FUNC_RE = /^(\s*)(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)\s*\(([^)]*)\)|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*\w+\s*)?=>|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function\s*\(([^)]*)\))/;

function extractFunctions(lines: string[]): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = FUNC_RE.exec(lines[i]);
    if (!match) continue;

    const paramStr = (match[3] ?? match[4] ?? match[5] ?? '').trim();
    const params = paramStr ? paramStr.split(',').map(p => p.replace(/[:=].*$/, '').trim()).filter(Boolean) : [];

    // Find end of function by brace matching
    let depth = 0;
    let end = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth <= 0 && j > i) { end = j; break; }
      if (j === lines.length - 1) end = j;
    }

    const body = lines.slice(i, end + 1);
    const bodyText = body.join('\n');

    const hasTryCatch = /\btry\s*\{/.test(bodyText) && /\bcatch\s*\(/.test(bodyText);

    // Parameter validation: if/throw near the start of function body
    const hasParamValidation = body.slice(0, Math.min(body.length, 8)).some(
      l => /if\s*\(.*\)\s*\{?\s*(throw|return)\b/.test(l) || /throw\s+new\s+/.test(l)
    );

    // Check for JSDoc above function
    let hasJSDoc = false;
    let jsdocParamsMatch = false;
    if (i > 0) {
      let docEnd = i - 1;
      while (docEnd >= 0 && lines[docEnd].trim() === '') docEnd--;
      if (docEnd >= 0 && lines[docEnd].trim().endsWith('*/')) {
        let docStart = docEnd;
        while (docStart > 0 && !lines[docStart].includes('/**')) docStart--;
        if (lines[docStart].includes('/**')) {
          hasJSDoc = true;
          const docBlock = lines.slice(docStart, docEnd + 1).join('\n');
          const docParams = (docBlock.match(/@param\b/g) ?? []).length;
          jsdocParamsMatch = params.length > 0 && docParams === params.length;
        }
      }
    }

    functions.push({ startLine: i, endLine: end, params, hasTryCatch, hasParamValidation, hasJSDoc, jsdocParamsMatch });
  }

  return functions;
}

export const completenessHeuristic: Heuristic = {
  name: 'completeness',
  weight: 0.15,

  analyze(lines: string[], _context: AnalysisContext): LineScore[] {
    const baseScores: LineScore[] = lines.map((content, i) => ({
      lineNumber: i + 1, content, aiProbability: 0.5, signals: [],
    }));

    const functions = extractFunctions(lines);
    if (functions.length === 0) return baseScores;

    const completeFunctions = functions.filter(f => f.hasTryCatch && f.hasParamValidation && f.hasJSDoc);
    const completenessRatio = completeFunctions.length / functions.length;

    // Check if every function has consistent JSDoc with @param for every parameter
    const allJsdocMatch = functions.every(f => f.hasJSDoc && f.jsdocParamsMatch);

    let score: number;
    let reason: string;

    if (completenessRatio > 0.8 && functions.length > 3) {
      score = 0.75;
      reason = `Too-complete code: ${completeFunctions.length}/${functions.length} functions have try/catch + validation + JSDoc`;
      if (allJsdocMatch) {
        score = 0.85;
        reason += ' (all JSDoc @param tags match parameters perfectly)';
      }
    } else if (completenessRatio < 0.3 && functions.length > 3) {
      score = 0.20;
      reason = `Incomplete code: only ${completeFunctions.length}/${functions.length} functions fully documented/guarded`;
    } else {
      score = 0.5;
      reason = `Moderate completeness: ${completeFunctions.length}/${functions.length} functions complete`;
    }

    // Apply score to lines within function blocks
    for (const func of functions) {
      for (let i = func.startLine; i <= func.endLine && i < baseScores.length; i++) {
        baseScores[i].aiProbability = score;
        baseScores[i].signals.push({ heuristic: 'completeness', score, reason });
      }
    }

    return baseScores;
  },
};
