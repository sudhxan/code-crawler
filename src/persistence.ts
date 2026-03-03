import * as fs from 'node:fs';
import * as path from 'node:path';
import { AuthorshipMap } from './authorship-map.js';
import type { FileAuthorship } from './types.js';

const DATA_DIR = '.code-crawler';
const AUTHORSHIP_DIR = 'authorship';

function getAuthorshipPath(repoRoot: string, filePath: string): string {
  const relative = path.relative(repoRoot, filePath);
  return path.join(repoRoot, DATA_DIR, AUTHORSHIP_DIR, relative + '.json');
}

export function saveFileAuthorship(
  repoRoot: string,
  filePath: string,
  map: AuthorshipMap,
): void {
  const outPath = getAuthorshipPath(repoRoot, filePath);
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });

  const data = map.toJSON();
  data.filePath = path.relative(repoRoot, filePath);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
}

export function loadFileAuthorship(
  repoRoot: string,
  filePath: string,
): AuthorshipMap | null {
  const jsonPath = getAuthorshipPath(repoRoot, filePath);
  if (!fs.existsSync(jsonPath)) return null;

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data: FileAuthorship = JSON.parse(raw);
  return AuthorshipMap.fromJSON(data);
}

export function loadAllAuthorship(repoRoot: string): FileAuthorship[] {
  const authorshipDir = path.join(repoRoot, DATA_DIR, AUTHORSHIP_DIR);
  if (!fs.existsSync(authorshipDir)) return [];

  const results: FileAuthorship[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.json')) {
        const raw = fs.readFileSync(full, 'utf-8');
        results.push(JSON.parse(raw));
      }
    }
  }

  walk(authorshipDir);
  return results;
}
