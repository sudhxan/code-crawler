import { describe, it, expect } from 'vitest';
import { completenessHeuristic } from '../../src/analyzer/heuristics/completeness.js';
import type { AnalysisContext } from '../../src/analyzer/types.js';

const ctx: AnalysisContext = { filePath: 'test.ts', language: 'typescript', fullContent: '' };

describe('completenessHeuristic', () => {
  it('scores fully documented/error-handled code as AI', () => {
    const makeFunction = (name: string, param: string) => [
      `/**`,
      ` * Process the ${name} operation.`,
      ` * @param ${param} - The ${param} to process`,
      ` */`,
      `export async function ${name}(${param}: string) {`,
      `  if (!${param}) {`,
      `    throw new Error('${param} is required');`,
      `  }`,
      `  try {`,
      `    const result = await service.${name}(${param});`,
      `    return result;`,
      `  } catch (error) {`,
      `    logger.error('Failed', error);`,
      `    throw error;`,
      `  }`,
      `}`,
    ];

    const lines = [
      ...makeFunction('createUser', 'name'),
      '',
      ...makeFunction('deleteUser', 'id'),
      '',
      ...makeFunction('updateUser', 'data'),
      '',
      ...makeFunction('getUser', 'id'),
    ];

    const scores = completenessHeuristic.analyze(lines, ctx);
    const functionLines = scores.filter(s => s.signals.length > 0);
    expect(functionLines.length).toBeGreaterThan(0);
    // All function lines should have high AI probability
    expect(functionLines[0].aiProbability).toBeGreaterThanOrEqual(0.75);
  });

  it('scores messy human code low', () => {
    const lines = [
      'function quickParse(s) {',
      '  let out = {};',
      '  s.split("&").forEach(p => {',
      '    let [k, v] = p.split("=");',
      '    out[k] = v;',
      '  });',
      '  return out;',
      '}',
      '',
      'function renderTable(data) {',
      '  let html = "<table>";',
      '  for (let row of data) {',
      '    html += "<tr>";',
      '    for (let cell of row) {',
      '      html += `<td>${cell}</td>`;',
      '    }',
      '    html += "</tr>";',
      '  }',
      '  return html + "</table>";',
      '}',
      '',
      'function debounce(fn, ms) {',
      '  let t;',
      '  return (...a) => {',
      '    clearTimeout(t);',
      '    t = setTimeout(() => fn(...a), ms);',
      '  };',
      '}',
      '',
      'const sum = (arr) => {',
      '  return arr.reduce((a, b) => a + b, 0);',
      '}',
    ];

    const scores = completenessHeuristic.analyze(lines, ctx);
    const functionLines = scores.filter(s => s.signals.length > 0);
    expect(functionLines.length).toBeGreaterThan(0);
    // Messy code should get low AI probability
    expect(functionLines[0].aiProbability).toBeLessThanOrEqual(0.20);
  });

  it('boosts score when all JSDoc @param tags match perfectly', () => {
    const makeFunction = (name: string, p1: string, p2: string) => [
      `/**`,
      ` * ${name} operation.`,
      ` * @param ${p1} - First param`,
      ` * @param ${p2} - Second param`,
      ` */`,
      `export function ${name}(${p1}: string, ${p2}: number) {`,
      `  if (!${p1}) {`,
      `    throw new TypeError('invalid');`,
      `  }`,
      `  try {`,
      `    return doWork(${p1}, ${p2});`,
      `  } catch (e) {`,
      `    console.error(e);`,
      `    throw e;`,
      `  }`,
      `}`,
    ];

    const lines = [
      ...makeFunction('alpha', 'foo', 'bar'),
      '',
      ...makeFunction('beta', 'baz', 'qux'),
      '',
      ...makeFunction('gamma', 'one', 'two'),
      '',
      ...makeFunction('delta', 'three', 'four'),
    ];

    const scores = completenessHeuristic.analyze(lines, ctx);
    const functionLines = scores.filter(s => s.signals.length > 0);
    // Should get the boosted score of 0.85
    expect(functionLines[0].aiProbability).toBe(0.85);
    expect(functionLines[0].signals[0].reason).toContain('JSDoc @param tags match');
  });

  it('returns neutral for files with no functions', () => {
    const lines = ['const x = 1;', 'const y = 2;', 'export { x, y };'];
    const scores = completenessHeuristic.analyze(lines, ctx);
    expect(scores.every(s => s.aiProbability === 0.5)).toBe(true);
  });

  it('has correct name and weight', () => {
    expect(completenessHeuristic.name).toBe('completeness');
    expect(completenessHeuristic.weight).toBe(0.15);
  });
});
