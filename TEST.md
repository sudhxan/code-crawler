# Testing Code Crawler

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npx vitest run

# Run tests in watch mode (re-runs on file changes)
npx vitest
```

## Project Test Structure

```
tests/
  analyzer.test.ts       # Unit tests for each heuristic (14 tests)
  integration.test.ts    # End-to-end analyzer tests (6 tests)
  cli.test.ts            # CLI module test (1 test)
  fixtures/
    ai-sample.ts         # Code that mimics AI-generated patterns
    human-sample.ts      # Code that mimics human-written patterns
```

## Understanding the Tests

### Unit Tests (analyzer.test.ts)

Each heuristic is tested individually. Here's how they work:

```typescript
import { describe, it, expect } from 'vitest';
import { namingHeuristic } from '../src/analyzer/heuristics/naming.js';

describe('namingHeuristic', () => {
  // Every heuristic has the same interface:
  //   heuristic.analyze(lines: string[], context: AnalysisContext) => LineScore[]

  it('scores generic names as AI-like', () => {
    const lines = ['const data = result.items;'];
    const context = {
      filePath: 'test.ts',
      language: 'typescript',
      fullContent: lines.join('\n'),
    };

    const scores = namingHeuristic.analyze(lines, context);

    // aiProbability closer to 1.0 = more likely AI
    // aiProbability closer to 0.0 = more likely human
    expect(scores[0].aiProbability).toBeGreaterThan(0.5);
  });
});
```

**What each heuristic test checks:**

| Heuristic | High AI signal (>0.5) | Low AI signal (<0.5) |
|-----------|----------------------|---------------------|
| naming | `data`, `result`, `item` | `customerOrder`, `invoiceTotal` |
| comments | `// loop through array` | `// TODO: fix race condition` |
| entropy | Repetitive, predictable code | Varied, irregular code |
| structure | All functions same length | Mixed function sizes |
| git-signals | 100+ lines added at once | Small incremental changes |

### Integration Tests (integration.test.ts)

These test the full pipeline end-to-end:

```typescript
import { analyzeCode } from '../src/analyzer/detector.js';

it('AI sample scores higher than human sample', () => {
  const aiResult = analyzeCode(aiCode, 'ai.ts', true);    // skipGit=true
  const humanResult = analyzeCode(humanCode, 'human.ts', true);

  expect(aiResult.summary.aiPercentage).toBeGreaterThan(
    humanResult.summary.aiPercentage
  );
});
```

The third argument `true` skips git analysis (since test fixtures aren't in real git history).

### CLI Test (cli.test.ts)

Simply verifies the CLI module can be imported without crashing.

## How to Write New Tests

### 1. Testing a new heuristic

```typescript
// tests/analyzer.test.ts - add to existing file
import { myNewHeuristic } from '../src/analyzer/heuristics/my-new.js';

describe('myNewHeuristic', () => {
  const makeContext = (content: string) => ({
    filePath: 'test.ts',
    language: 'typescript',
    fullContent: content,
  });

  it('detects AI pattern X', () => {
    const lines = ['// your test input'];
    const scores = myNewHeuristic.analyze(lines, makeContext(lines.join('\n')));
    expect(scores[0].aiProbability).toBeGreaterThan(0.6);
  });

  it('recognizes human pattern Y', () => {
    const lines = ['// your test input'];
    const scores = myNewHeuristic.analyze(lines, makeContext(lines.join('\n')));
    expect(scores[0].aiProbability).toBeLessThan(0.4);
  });
});
```

### 2. Adding a new fixture

Create a file in `tests/fixtures/` with clearly AI or human characteristics, then use it in integration tests:

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture = readFileSync(
  resolve(__dirname, 'fixtures/my-new-sample.ts'),
  'utf-8'
);
```

### 3. Testing the full analyzer on real code

```typescript
it('analyzes a real file', () => {
  const realCode = readFileSync('/path/to/real/file.ts', 'utf-8');
  const result = analyzeCode(realCode, 'file.ts', true);

  console.log(`AI: ${result.summary.aiPercentage}%`);
  console.log(`Human: ${result.summary.humanPercentage}%`);
  console.log(`Confidence: ${(result.summary.confidence * 100).toFixed(0)}%`);

  // Check per-line breakdown
  result.lineScores
    .filter(l => l.aiProbability > 0.7)
    .forEach(l => console.log(`Line ${l.lineNumber}: ${l.content} (${l.aiProbability})`));
});
```

## Useful Vitest Commands

```bash
# Run a specific test file
npx vitest run tests/analyzer.test.ts

# Run tests matching a pattern
npx vitest run -t "naming"

# Run with verbose output
npx vitest run --reporter=verbose

# See code coverage
npx vitest run --coverage

# Run in UI mode (browser-based test explorer)
npx vitest --ui
```

## Key Concepts

### LineScore

Every line gets scored independently:

```typescript
{
  lineNumber: 42,
  content: 'const data = fetchResult(item);',
  aiProbability: 0.73,          // 0 = human, 1 = AI
  signals: [
    { heuristic: 'naming', score: 0.8, reason: 'Generic names: data, item' }
  ]
}
```

### AnalysisSummary

Aggregated results per file:

```typescript
{
  totalLines: 150,
  aiLines: 45,        // lines with aiProbability >= 0.6
  humanLines: 105,
  aiPercentage: 30,
  humanPercentage: 70,
  confidence: 0.4     // how decisive the signal is (0-1)
}
```

### The 0.6 Threshold

Lines with `aiProbability >= 0.6` are counted as "AI lines". This threshold is defined in `src/analyzer/scorer.ts` as `AI_THRESHOLD`. Lower it to catch more AI code (more sensitive, more false positives). Raise it for fewer but higher-confidence detections.
