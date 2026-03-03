import { Heuristic, LineScore, AnalysisContext } from '../types.js';

const GENERIC_NAMES = new Set([
  'data', 'result', 'results', 'item', 'items', 'value', 'values',
  'temp', 'tmp', 'handler', 'callback', 'response', 'res', 'req',
  'error', 'err', 'index', 'idx', 'count', 'flag', 'status',
  'output', 'input', 'obj', 'arr', 'str', 'num', 'val',
  'element', 'el', 'node', 'list', 'map', 'set',
  'key', 'name', 'type', 'info', 'config', 'options', 'params',
  'args', 'ret', 'retVal', 'returnValue',
]);

const IDENTIFIER_RE = /\b(?:const|let|var|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
const PARAM_RE = /\(([^)]*)\)/g;

function extractIdentifiers(line: string): string[] {
  const ids: string[] = [];

  let m: RegExpExecArray | null;
  IDENTIFIER_RE.lastIndex = 0;
  while ((m = IDENTIFIER_RE.exec(line)) !== null) {
    ids.push(m[1]);
  }

  PARAM_RE.lastIndex = 0;
  while ((m = PARAM_RE.exec(line)) !== null) {
    const params = m[1].split(',').map(p => p.trim().split(/[\s:=]/)[0]).filter(Boolean);
    ids.push(...params);
  }

  return ids;
}

export const namingHeuristic: Heuristic = {
  name: 'naming',
  weight: 0.2,

  analyze(lines: string[], _context: AnalysisContext): LineScore[] {
    return lines.map((content, i) => {
      const identifiers = extractIdentifiers(content);
      if (identifiers.length === 0) {
        return { lineNumber: i + 1, content, aiProbability: 0.5, signals: [] };
      }

      const genericCount = identifiers.filter(id => GENERIC_NAMES.has(id)).length;
      const ratio = genericCount / identifiers.length;
      const score = Math.min(ratio * 1.2, 1);

      const signals = genericCount > 0
        ? [{ heuristic: 'naming', score, reason: `Generic names: ${identifiers.filter(id => GENERIC_NAMES.has(id)).join(', ')}` }]
        : [{ heuristic: 'naming', score: 0.1, reason: 'Domain-specific naming' }];

      return { lineNumber: i + 1, content, aiProbability: score, signals };
    });
  },
};
