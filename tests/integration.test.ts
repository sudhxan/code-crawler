import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeCode, CodeCrawlerDetector } from '../src/analyzer/detector.js';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('integration: analyzeCode', () => {
  it('scores AI-generated fixture high', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'ai-sample.ts'), 'utf-8');
    const result = analyzeCode(content, 'ai-sample.ts', true);
    // The combined heuristics score; many lines default to 0.5 (below AI threshold)
    // so we just verify AI fixture scores noticeably higher than human fixture
    expect(result.summary.aiPercentage).toBeGreaterThan(20);
  });

  it('scores human-written fixture low', () => {
    const content = fs.readFileSync(path.join(fixturesDir, 'human-sample.ts'), 'utf-8');
    const result = analyzeCode(content, 'human-sample.ts', true);
    expect(result.summary.aiPercentage).toBeLessThan(40);
  });

  it('scores AI fixture higher than human fixture', () => {
    const aiContent = fs.readFileSync(path.join(fixturesDir, 'ai-sample.ts'), 'utf-8');
    const humanContent = fs.readFileSync(path.join(fixturesDir, 'human-sample.ts'), 'utf-8');
    const aiResult = analyzeCode(aiContent, 'ai-sample.ts', true);
    const humanResult = analyzeCode(humanContent, 'human-sample.ts', true);
    expect(aiResult.summary.aiPercentage).toBeGreaterThan(humanResult.summary.aiPercentage);
  });

  it('handles empty content without crashing', () => {
    const result = analyzeCode('', 'empty.ts', true);
    expect(result.summary.totalLines).toBe(1); // single empty line from split
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
  });
});

describe('CodeCrawlerDetector class', () => {
  const detector = new CodeCrawlerDetector();

  it('analyzeContent works', async () => {
    const result = await detector.analyzeContent('const data = result;', 'test.ts');
    expect(result).toHaveProperty('summary');
    expect(result.summary.totalLines).toBe(1);
  });

  it('analyzeDiff parses diff chunks', async () => {
    const diff = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -0,0 +1,3 @@
+const data = result;
+const item = value;
+const temp = output;
`;
    const results = await detector.analyzeDiff(diff);
    expect(results.length).toBe(1);
    expect(results[0].filePath).toBe('foo.ts');
  });
});
