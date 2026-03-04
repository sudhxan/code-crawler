/** Raw edit event captured from VS Code's onDidChangeTextDocument */
export interface EditEvent {
  timestamp: number;
  filePath: string;
  changes: EditChange[];
  timeSinceLastEdit: number;
}

/** Individual change within an edit event */
export interface EditChange {
  text: string;           // inserted text
  rangeOffset: number;    // start position in document
  rangeLength: number;    // number of chars deleted/replaced
  linesInserted: number;
  linesDeleted: number;
}

/** Classification result for a single edit event */
export interface EditClassification {
  type: 'ai' | 'human' | 'paste' | 'formatter' | 'uncertain';
  confidence: number;
  reason: string;
}

/** Authorship data for a single line */
export interface LineAuthorship {
  line: number;
  author: 'ai' | 'human' | 'mixed';
  confidence: number;
  aiEdits: number;
  humanEdits: number;
  lastEditType: 'ai' | 'human';
  lastEditTimestamp: number;
  signals?: SignalScores;
  editHistory?: EditHistoryEntry[];
}

/** Authorship data for an entire file */
export interface FileAuthorship {
  filePath: string;
  lines: LineAuthorship[];
  summary: AuthorshipSummary;
  lastUpdated: number;
}

/** Summary statistics for authorship */
export interface AuthorshipSummary {
  totalLines: number;
  aiLines: number;
  humanLines: number;
  mixedLines: number;
  aiPercentage: number;
  humanPercentage: number;
}

/** Report for a commit or snapshot in time */
export interface CommitReport {
  commitHash?: string;
  timestamp: number;
  files: FileAuthorship[];
  overall: AuthorshipSummary;
}

// ─── V3 Multi-Signal Detection Types ────────────────────────────

/** Timestamped edit for session-level tracking */
export interface TimestampedEdit {
  timestamp: number;
  line: number;
  charsInserted: number;
  charsDeleted: number;
  linesInserted: number;
}

/** Cursor movement event captured from onDidChangeTextEditorSelection */
export interface CursorEvent {
  timestamp: number;
  line: number;
  character: number;
  isSelection: boolean;
  selectionLength: number;
}

/** Scores from all detection signals (0 = human, 1 = AI, 0.5 = no data) */
export interface SignalScores {
  typingRhythm: number;
  editSize: number;
  cursorMovement: number;
  editSequence: number;
  undoFrequency: number;
  extensionSource: number;
  velocityProfile: number;
  selectionPattern: number;
  pastePattern: number;
  deletionPattern: number;
  pausePattern: number;
}

/** Enhanced classification with multi-signal fusion */
export interface EnhancedClassification {
  type: 'ai' | 'human' | 'paste' | 'formatter' | 'uncertain';
  confidence: number;
  reason: string;
  signals: SignalScores;
  fusedConfidence: number;
  dominantSignal: string;
}

/** Edit history entry for per-line tracking */
export interface EditHistoryEntry {
  timestamp: number;
  type: 'ai' | 'human' | 'paste' | 'formatter';
  charsChanged: number;
}
