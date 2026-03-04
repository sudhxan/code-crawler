import { describe, it, expect } from 'vitest';
import { repetitionHeuristic } from '../../src/analyzer/heuristics/repetition.js';
import type { AnalysisContext } from '../../src/analyzer/types.js';

const ctx: AnalysisContext = { filePath: 'test.ts', language: 'typescript', fullContent: '' };

describe('repetitionHeuristic', () => {
  it('detects repetitive CRUD functions as AI', () => {
    // Generate 4 nearly identical CRUD blocks (structurally same, different names)
    const makeBlock = (entity: string) => [
      `export async function create${entity}(data: ${entity}Input) {`,
      `  const result = await db.${entity.toLowerCase()}.create({ data });`,
      `  if (!result) {`,
      `    throw new Error('Failed to create ${entity}');`,
      `  }`,
      `  logger.info('Created ${entity}', { id: result.id });`,
      `  return result;`,
      `}`,
      ``,
      `export async function update${entity}(id: string, data: Partial<${entity}Input>) {`,
      `  const result = await db.${entity.toLowerCase()}.update({ where: { id }, data });`,
      `  if (!result) {`,
      `    throw new Error('Failed to update ${entity}');`,
      `  }`,
      `  logger.info('Updated ${entity}', { id: result.id });`,
      `  return result;`,
      `}`,
    ];

    const lines = [
      ...makeBlock('User'),
      '',
      ...makeBlock('Post'),
      '',
      ...makeBlock('Comment'),
      '',
      ...makeBlock('Tag'),
    ];

    const scores = repetitionHeuristic.analyze(lines, ctx);
    const aiLines = scores.filter(s => s.aiProbability > 0.6);
    expect(aiLines.length).toBeGreaterThan(0);
    // Many lines should be flagged as repetitive
    expect(aiLines.length).toBeGreaterThan(lines.length * 0.2);
  });

  it('scores varied human code low', () => {
    const lines = [
      'import { readFile } from "fs/promises";',
      '',
      '// TODO: handle binary files differently',
      'async function loadConfig(path: string) {',
      '  const raw = await readFile(path, "utf-8");',
      '  return JSON.parse(raw);',
      '}',
      '',
      'class TokenBucket {',
      '  private tokens: number;',
      '  private lastRefill: number;',
      '',
      '  constructor(private capacity: number, private refillRate: number) {',
      '    this.tokens = capacity;',
      '    this.lastRefill = Date.now();',
      '  }',
      '',
      '  tryConsume(): boolean {',
      '    this.refill();',
      '    if (this.tokens > 0) {',
      '      this.tokens--;',
      '      return true;',
      '    }',
      '    return false;',
      '  }',
      '',
      '  private refill() {',
      '    const now = Date.now();',
      '    const elapsed = (now - this.lastRefill) / 1000;',
      '    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);',
      '    this.lastRefill = now;',
      '  }',
      '}',
    ];

    const scores = repetitionHeuristic.analyze(lines, ctx);
    const aiLines = scores.filter(s => s.aiProbability > 0.6);
    // Varied code should not trigger high AI scores
    expect(aiLines.length).toBe(0);
  });

  it('returns neutral scores for short files', () => {
    const lines = ['const x = 1;', 'const y = 2;', 'console.log(x + y);'];
    const scores = repetitionHeuristic.analyze(lines, ctx);
    expect(scores.every(s => s.aiProbability === 0.5)).toBe(true);
  });

  it('has correct name and weight', () => {
    expect(repetitionHeuristic.name).toBe('repetition');
    expect(repetitionHeuristic.weight).toBe(0.15);
  });
});
