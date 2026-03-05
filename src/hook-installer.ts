import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

// Git hook that attaches Code Crawler authorship data to commit messages as a trailer.
// Users opt in by running `code-crawler install-hooks`. The trailer is a standard
// git trailer (like Signed-off-by) containing per-file AI/human authorship percentages.
const PREPARE_COMMIT_MSG_HOOK = `#!/bin/sh
# Code Crawler: Attach authorship fingerprint trailer to commit message.
# Installed by: code-crawler install-hooks

COMMIT_MSG_FILE="$1"
COMMIT_SOURCE="$2"

# Only inject on normal commits (not merge, squash, amend, etc.)
if [ -z "$COMMIT_SOURCE" ] || [ "$COMMIT_SOURCE" = "message" ]; then
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
  if [ -z "$REPO_ROOT" ]; then exit 0; fi

  STAGED_FILES=$(git diff --cached --name-only)
  if [ -z "$STAGED_FILES" ]; then exit 0; fi

  if command -v code-crawler >/dev/null 2>&1; then
    code-crawler inject-fingerprint "$COMMIT_MSG_FILE" "$REPO_ROOT" $STAGED_FILES
  elif [ -f "$REPO_ROOT/node_modules/.bin/code-crawler" ]; then
    "$REPO_ROOT/node_modules/.bin/code-crawler" inject-fingerprint "$COMMIT_MSG_FILE" "$REPO_ROOT" $STAGED_FILES
  fi
fi

exit 0
`;

// Git hook that runs after a pull/merge to analyze incoming code.
// Checks for authorship fingerprints in incoming commits and runs forensic analysis.
const POST_MERGE_HOOK = `#!/bin/sh
# Code Crawler: Analyze incoming code after pull/merge.
# Installed by: code-crawler install-hooks

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then exit 0; fi

if git rev-parse --verify ORIG_HEAD >/dev/null 2>&1; then
  if command -v code-crawler >/dev/null 2>&1; then
    code-crawler analyze-pull "$REPO_ROOT" "ORIG_HEAD..HEAD" &
  elif [ -f "$REPO_ROOT/node_modules/.bin/code-crawler" ]; then
    "$REPO_ROOT/node_modules/.bin/code-crawler" analyze-pull "$REPO_ROOT" "ORIG_HEAD..HEAD" &
  fi
fi

exit 0
`;

/**
 * Install Code Crawler git hooks into a repository.
 * Preserves existing hooks by backing them up.
 */
export function installHooks(repoRoot: string): { installed: string[]; skipped: string[] } {
  const gitDir = getGitDir(repoRoot);
  if (!gitDir) {
    return { installed: [], skipped: ['Not a git repository'] };
  }

  const hooksDir = path.join(gitDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const installed: string[] = [];
  const skipped: string[] = [];

  const r1 = installSingleHook(hooksDir, 'prepare-commit-msg', PREPARE_COMMIT_MSG_HOOK);
  if (r1) installed.push('prepare-commit-msg');
  else skipped.push('prepare-commit-msg (already installed)');

  const r2 = installSingleHook(hooksDir, 'post-merge', POST_MERGE_HOOK);
  if (r2) installed.push('post-merge');
  else skipped.push('post-merge (already installed)');

  return { installed, skipped };
}

/**
 * Remove Code Crawler git hooks, restoring originals if they existed.
 */
export function uninstallHooks(repoRoot: string): string[] {
  const gitDir = getGitDir(repoRoot);
  if (!gitDir) return [];

  const hooksDir = path.join(gitDir, 'hooks');
  const removed: string[] = [];

  for (const hookName of ['prepare-commit-msg', 'post-merge']) {
    const hookPath = path.join(hooksDir, hookName);
    if (!fs.existsSync(hookPath)) continue;

    const content = fs.readFileSync(hookPath, 'utf-8');
    if (content.includes('Code Crawler')) {
      const backupPath = hookPath + '.pre-code-crawler';
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, hookPath);
        fs.unlinkSync(backupPath);
      } else {
        fs.unlinkSync(hookPath);
      }
      removed.push(hookName);
    }
  }

  return removed;
}

/**
 * Check which hooks are currently installed.
 */
export function checkHooks(repoRoot: string): { prepareCommitMsg: boolean; postMerge: boolean } {
  const gitDir = getGitDir(repoRoot);
  if (!gitDir) return { prepareCommitMsg: false, postMerge: false };

  const hooksDir = path.join(gitDir, 'hooks');
  return {
    prepareCommitMsg: hookHasCodeCrawler(path.join(hooksDir, 'prepare-commit-msg')),
    postMerge: hookHasCodeCrawler(path.join(hooksDir, 'post-merge')),
  };
}

function getGitDir(repoRoot: string): string | null {
  try {
    const result = execSync('git rev-parse --git-dir', {
      cwd: repoRoot,
      encoding: 'utf-8',
    }).trim();
    return path.isAbsolute(result) ? result : path.join(repoRoot, result);
  } catch {
    return null;
  }
}

function hookHasCodeCrawler(hookPath: string): boolean {
  if (!fs.existsSync(hookPath)) return false;
  return fs.readFileSync(hookPath, 'utf-8').includes('Code Crawler');
}

function installSingleHook(hooksDir: string, hookName: string, hookContent: string): boolean {
  const hookPath = path.join(hooksDir, hookName);

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf-8');
    if (existing.includes('Code Crawler')) return false;

    // Backup existing hook before wrapping
    fs.copyFileSync(hookPath, hookPath + '.pre-code-crawler');
    const wrapped = existing.trimEnd() + '\n\n' + hookContent.split('\n').slice(1).join('\n');
    fs.writeFileSync(hookPath, wrapped, { mode: 0o755 });
  } else {
    fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
  }

  return true;
}
