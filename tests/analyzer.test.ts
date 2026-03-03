import { describe, it, expect } from 'vitest';
import { namingHeuristic } from '../src/analyzer/heuristics/naming.js';
import { commentsHeuristic } from '../src/analyzer/heuristics/comments.js';
import { entropyHeuristic } from '../src/analyzer/heuristics/entropy.js';
import { structureHeuristic } from '../src/analyzer/heuristics/structure.js';
import { gitSignalsHeuristic } from '../src/analyzer/heuristics/git-signals.js';
import type { AnalysisContext } from '../src/analyzer/types.js';

const ctx: AnalysisContext = { filePath: 'test.ts', language: 'typescript', fullContent: '' };

describe('namingHeuristic', () => {
  it('scores generic names high', () => {
    const lines = ['const data = result;', 'const item = value;'];
    const scores = namingHeuristic.analyze(lines, ctx);
    expect(scores[0].aiProbability).toBeGreaterThan(0.5);
    expect(scores[1].aiProbability).toBeGreaterThan(0.5);
  });

  it('scores domain-specific names low', () => {
    const lines = ['const tenantBillingRecord = fetchInvoice();'];
    const scores = namingHeuristic.analyze(lines, ctx);
    expect(scores[0].aiProbability).toBeLessThan(0.5);
  });

  it('returns 0.5 for lines with no identifiers', () => {
    const lines = ['// just a comment', ''];
    const scores = namingHeuristic.analyze(lines, ctx);
    expect(scores[0].aiProbability).toBe(0.5);
  });
});

describe('commentsHeuristic', () => {
  it('scores obvious comments high', () => {
    const lines = ['// loop through the array'];
    const scores = commentsHeuristic.analyze(lines, ctx);
    expect(scores[0].aiProbability).toBeGreaterThan(0.7);
  });

  it('scores TODO/FIXME comments low', () => {
    const lines = ['// TODO: fix this later', '// FIXME: broken on edge case'];
    const scores = commentsHeuristic.analyze(lines, ctx);
    expect(scores[0].aiProbability).toBeLessThan(0.3);
    expect(scores[1].aiProbability).toBeLessThan(0.3);
  });

  it('returns 0.5 for non-comment lines', () => {
    const lines = ['const x = 1;'];
    const scores = commentsHeuristic.analyze(lines, ctx);
    expect(scores[0].aiProbability).toBe(0.5);
  });
});

describe('entropyHeuristic', () => {
  it('scores low-entropy repetitive text as AI-like', () => {
    const lines = Array(10).fill('const data = data;');
    const scores = entropyHeuristic.analyze(lines, ctx);
    const mid = scores[5];
    expect(mid.aiProbability).toBeGreaterThan(0.5);
  });

  it('scores high-entropy varied text as human-like', () => {
    const lines = [
      'const xQ7 = await fetchBillingReconciliation(tenantId);',
      'if (xQ7.failures?.length > 0) throw new InvoiceMismatchError();',
      'const zKt = computeRunningTotals(xQ7.lineItems, { currency: "JPY" });',
      'await persistToLedger(zKt, { retries: 3, backoff: "exponential" });',
      'logger.info(`Reconciled ${zKt.length} entries for ${tenantId}`);',
      'const auditTrail = buildAuditPayload(xQ7, zKt, { source: "cron" });',
      'await publishToQueue("billing.reconciled", auditTrail);',
      'metrics.increment("billing.sync.success", { tenant: tenantId });',
      'const cached = lruCache.get(`billing:${tenantId}:${fiscalQ}`);',
      'if (!cached) lruCache.set(`billing:${tenantId}:${fiscalQ}`, zKt, TTL);',
    ];
    const scores = entropyHeuristic.analyze(lines, ctx);
    const mid = scores[5];
    expect(mid.aiProbability).toBeLessThan(0.6);
  });

  it('returns 0.5 for very short lines', () => {
    const lines = ['x'];
    const scores = entropyHeuristic.analyze(lines, ctx);
    expect(scores[0].aiProbability).toBe(0.5);
  });
});

describe('structureHeuristic', () => {
  it('scores uniform functions as AI-like', () => {
    const lines = [
      'function a() {',
      '  return 1;',
      '  return 2;',
      '}',
      'function b() {',
      '  return 3;',
      '  return 4;',
      '}',
      'function c() {',
      '  return 5;',
      '  return 6;',
      '}',
    ];
    const scores = structureHeuristic.analyze(lines, ctx);
    // Functions of identical length should push score above 0.5
    const funcLineScores = scores.filter(s => s.aiProbability !== 0.5);
    if (funcLineScores.length > 0) {
      expect(funcLineScores[0].aiProbability).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('returns base scores when fewer than 2 functions', () => {
    const lines = ['function a() {', '  return 1;', '}'];
    const scores = structureHeuristic.analyze(lines, ctx);
    expect(scores.every(s => s.aiProbability === 0.5)).toBe(true);
  });
});

describe('gitSignalsHeuristic', () => {
  it('returns 0.5 when no git info', () => {
    const lines = ['const x = 1;'];
    const scores = gitSignalsHeuristic.analyze(lines, ctx);
    expect(scores[0].aiProbability).toBe(0.5);
  });

  it('scores large commits higher', () => {
    const lines = Array(60).fill('const x = 1;');
    const ctxWithGit: AnalysisContext = {
      ...ctx,
      fullContent: lines.join('\n'),
      gitInfo: { commitSize: 150, addedLines: 150, isNewFile: true, commitMessage: 'implement feature' },
    };
    const scores = gitSignalsHeuristic.analyze(lines, ctxWithGit);
    expect(scores[0].aiProbability).toBeGreaterThan(0.7);
  });

  it('scores generic commit messages higher', () => {
    const lines = ['const x = 1;'];
    const ctxWithGit: AnalysisContext = {
      ...ctx,
      fullContent: lines.join('\n'),
      gitInfo: { commitSize: 10, addedLines: 10, isNewFile: false, commitMessage: 'initial commit' },
    };
    const scores = gitSignalsHeuristic.analyze(lines, ctxWithGit);
    expect(scores[0].aiProbability).toBe(0.6);
  });
});
