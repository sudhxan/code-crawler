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
