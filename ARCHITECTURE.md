# Code Crawler Architecture: Keystroke-Level AI Detection

## How AI Tools Inject Code

All AI coding tools share a common pattern: they insert entire blocks of code as single atomic edit events, bypassing character-by-character typing.

### Tool-Specific Mechanisms

**Cursor / AI Editors:**
- Uses `vscode.workspace.applyEdit()` and `vscode.TextEditor.edit()` to insert complete code blocks
- Fires a single `onDidChangeTextDocument` event with the entire function/block in `contentChanges[0].text`
- Multi-line insertions arrive as one event, not line-by-line

**GitHub Copilot:**
- Accepts inline completions via `InlineCompletionItem`
- When user presses Tab, the entire suggestion is inserted as one edit event
- Ghost text becomes real text in a single atomic operation

**Claude Code / Aider / Terminal-Based Tools:**
- Writes files via filesystem (`fs.writeFileSync`) or applies surgical diffs
- When writing to open files, VS Code detects the external change and fires `onDidChangeTextDocument` with the full diff
- May also use `vscode.workspace.applyEdit()` for targeted insertions

**Windsurf / Other AI Editors:**
- Same fundamental pattern - editor API or filesystem writes
- All produce edit events with >>10 characters inserted, often multiple lines, in a single atomic edit

### Universal AI Signal
ALL AI tools produce edit events where:
- `contentChanges[0].text.length` >> 10 characters
- Often contains multiple newlines (multi-line blocks)
- Inter-event timing is near-zero (< 50ms between large insertions)

## How Humans Write Code

### Typing Patterns
- **Character-by-character:** Each keystroke = 1 edit event with 1-2 chars inserted
- **Inter-keystroke interval:** 50-300ms for fluent typing, 1-5s during thinking pauses
- **Error correction:** ~10-15% of keystrokes are backspace/delete operations
- **Bursts and pauses:** Humans type in bursts of 3-10 chars, then pause to read/think

### Non-Typing Human Edits
- **Copy-paste (Ctrl+V):** Single edit with pasted text, but from clipboard - distinguishable by preceding Ctrl+C pattern and typically smaller blocks
- **Snippets/Emmet:** Small expansions, typically < 20 chars
- **Auto-close brackets:** Editor inserts matching `}`, `)`, `]` - 1 char insertions

## Classification Algorithm

```
function classifyEdit(change, timeSinceLastEdit, editContext):
  charsInserted = change.text.length
  linesInserted = countNewlines(change.text)
  charsDeleted = change.rangeLength

  // === STRONG AI SIGNALS ===

  // Multi-line block insertion (functions, classes, etc.)
  if linesInserted >= 2 AND charsInserted > 30:
    return { type: 'ai', confidence: 0.95, reason: 'Multi-line block insertion' }

  // Large rapid insertion (< 50ms since last edit)
  if charsInserted > 50 AND timeSinceLastEdit < 50:
    return { type: 'ai', confidence: 0.90, reason: 'Large rapid insertion' }

  // Very large single insertion
  if charsInserted > 100:
    return { type: 'ai', confidence: 0.85, reason: 'Very large single insertion' }

  // === STRONG HUMAN SIGNALS ===

  // Single keystroke with natural typing delay
  if charsInserted <= 2 AND charsDeleted == 0 AND timeSinceLastEdit >= 30:
    return { type: 'human', confidence: 0.90, reason: 'Single keystroke with natural delay' }

  // Correction/backspace pattern
  if charsDeleted > 0 AND charsInserted <= 2:
    return { type: 'human', confidence: 0.85, reason: 'Correction/backspace' }

  // Slow typing after thinking pause
  if charsInserted <= 5 AND timeSinceLastEdit > 1000:
    return { type: 'human', confidence: 0.80, reason: 'Slow typing after pause' }

  // === SPECIAL CASES ===

  // Auto-formatter detection: many changes spanning entire file
  if many changes in single event AND covers entire file:
    return { type: 'formatter', confidence: 0.80, reason: 'Likely auto-format' }

  // Ambiguous - could be paste, snippet, or small AI suggestion
  if charsInserted > 5 AND charsInserted <= 30 AND linesInserted == 0:
    return { type: 'uncertain', confidence: 0.50, reason: 'Could be paste or autocomplete' }

  return { type: 'uncertain', confidence: 0.50 }
```

## Authorship Map Design

### Per-File Data Structure
Each file has an authorship map that tracks every line:

```
FileAuthorship {
  filePath: string
  lines: [
    { line: 1, author: 'human', confidence: 0.90, aiEdits: 0, humanEdits: 12, ... },
    { line: 2, author: 'ai',    confidence: 0.95, aiEdits: 1, humanEdits: 0, ... },
    ...
  ]
  summary: { totalLines, aiLines, humanLines, mixedLines, aiPercentage, humanPercentage }
}
```

### Line Tracking Rules
- When AI inserts N lines, all N lines are marked `author: 'ai'`
- When human types on a line character by character, it's marked `author: 'human'`
- When lines are inserted/deleted, all subsequent line numbers shift in the map
- **Transition threshold:** A line transitions from `ai` → `human` after 5+ human character edits OR 3+ separate human edit sessions on that line
- Lines with both AI and human edits below the transition threshold are marked `mixed`

### Line Number Shifting
When an insertion or deletion occurs at line L:
- **Insertion of N lines at L:** Lines >= L shift down by N
- **Deletion of N lines at L:** Lines >= L+N shift up by N, lines L to L+N-1 are removed

## Persistence

### Storage Structure
```
.code-crawler/
  config.json              # Extension settings
  authorship/
    src/
      index.ts.json        # Authorship data for src/index.ts
      utils/
        helpers.ts.json    # Authorship data for src/utils/helpers.ts
```

### File Format (per-file JSON)
```json
{
  "filePath": "src/index.ts",
  "lastUpdated": 1709500000000,
  "lines": [
    { "line": 1, "author": "human", "confidence": 0.9, "aiEdits": 0, "humanEdits": 8, "lastEditType": "human", "lastEditTimestamp": 1709499999000 }
  ],
  "summary": { "totalLines": 100, "aiLines": 40, "humanLines": 55, "mixedLines": 5, "aiPercentage": 40, "humanPercentage": 55 }
}
```

### Sharing
- `.code-crawler/` directory is committed to the repository
- Team members share authorship data automatically via git
- Merge conflicts in authorship files resolve by taking the most recent `lastEditTimestamp`

## Edge Cases

| Edge Case | Detection Strategy |
|---|---|
| **Auto-formatters (Prettier, ESLint --fix)** | Detect when a single event changes >80% of file lines or spans the entire file range. Mark as `formatter` type, do not alter authorship. |
| **Undo/Redo** | Detect by matching change that exactly reverses the immediately previous change (same range, swapped insert/delete text). Revert authorship to pre-edit state. |
| **Rename Symbol** | VS Code fires multiple `onDidChangeTextDocument` events across files simultaneously within <10ms. Detect by timestamp clustering + identical replacement text. Mark as `refactor`, preserve existing authorship. |
| **Terminal paste** | Large paste in integrated terminal - not tracked (terminal is not a text document). |
| **Git operations** | File changes from `git checkout`/`merge`/`rebase` fire as external file changes. Detect by checking for git lock file or rapid full-file replacements across many files. Preserve existing authorship or reset. |
| **Bracket auto-close** | 1 char insertion of `}`, `)`, `]`, `"`, `'` immediately after opening char. Treat as human (editor assistance, not AI). |
| **Import auto-complete** | VS Code auto-import inserts 1-2 lines at file top. Heuristic: insertion at line 1-5 of import/require statement, < 80 chars. Mark as `uncertain`. |

## VS Code API Surface

The extension hooks into:
- `vscode.workspace.onDidChangeTextDocument` - Primary edit event listener
- `vscode.workspace.onDidOpenTextDocument` - Initialize authorship for new files
- `vscode.workspace.onDidSaveTextDocument` - Persist authorship data
- `vscode.window.onDidChangeActiveTextEditor` - Track active file for UI decorations
- `vscode.workspace.onDidDeleteFiles` - Clean up authorship data
- `vscode.workspace.onDidRenameFiles` - Update authorship file paths
