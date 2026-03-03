import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { saveFileAuthorship, loadFileAuthorship, loadAllAuthorship } from '../src/persistence';
import { AuthorshipMap } from '../src/authorship-map';
import type { Classification } from '../src/classifier';

const humanClassification: Classification = { type: 'human', confidence: 0.90, reason: 'test' };
const aiClassification: Classification = { type: 'ai', confidence: 0.95, reason: 'test' };

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-crawler-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('persistence', () => {
  it('saves and loads authorship roundtrip', () => {
    const map = new AuthorshipMap();
    map.recordEdit(0, 0, ['human line'], humanClassification);
    map.recordEdit(1, 0, ['ai line'], aiClassification);

    const filePath = path.join(tmpDir, 'src', 'test.ts');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'dummy');

    saveFileAuthorship(tmpDir, filePath, map);
    const loaded = loadFileAuthorship(tmpDir, filePath);

    expect(loaded).not.toBeNull();
    expect(loaded!.getLineAuthorship(0)?.author).toBe('human');
    expect(loaded!.getLineAuthorship(1)?.author).toBe('ai');
  });

  it('returns null for missing file', () => {
    const loaded = loadFileAuthorship(tmpDir, path.join(tmpDir, 'nonexistent.ts'));
    expect(loaded).toBeNull();
  });

  it('creates .code-crawler directory automatically', () => {
    const map = new AuthorshipMap();
    map.recordEdit(0, 0, ['line'], humanClassification);

    const filePath = path.join(tmpDir, 'file.ts');
    saveFileAuthorship(tmpDir, filePath, map);

    expect(fs.existsSync(path.join(tmpDir, '.code-crawler', 'authorship'))).toBe(true);
  });

  it('loadAllAuthorship returns all saved files', () => {
    const map1 = new AuthorshipMap();
    map1.recordEdit(0, 0, ['line1'], humanClassification);
    const map2 = new AuthorshipMap();
    map2.recordEdit(0, 0, ['line2'], aiClassification);

    saveFileAuthorship(tmpDir, path.join(tmpDir, 'a.ts'), map1);
    saveFileAuthorship(tmpDir, path.join(tmpDir, 'b.ts'), map2);

    const all = loadAllAuthorship(tmpDir);
    expect(all.length).toBe(2);
  });

  it('loadAllAuthorship returns empty for missing directory', () => {
    const all = loadAllAuthorship(path.join(tmpDir, 'nonexistent'));
    expect(all).toEqual([]);
  });
});
