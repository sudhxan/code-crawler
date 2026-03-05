/**
 * Types for the forensic analysis system.
 * Used for static analysis of external code (e.g. pulled from another branch)
 * to detect AI vs human authorship when no keystroke data is available.
 */

/** Result from a single forensic analyzer */
export interface ForensicSignal {
  name: string;
  score: number;        // 0 = human, 1 = AI, 0.5 = inconclusive
  confidence: number;   // 0-1 how sure is this signal
  evidence: string[];   // human-readable evidence items
}

/** Git-level metadata about how code arrived */
export interface GitForensicData {
  commitHash: string;
  authorName: string;
  authorEmail: string;
  commitMessage: string;
  timestamp: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
  diffChunks: DiffChunk[];
}

export interface DiffChunk {
  filePath: string;
  startLine: number;
  addedLines: string[];
  removedLines: string[];
}

/** Stylometric features extracted from code */
export interface StyleFeatures {
  avgIdentifierLength: number;
  identifierConsistency: number;  // 0-1 how consistent naming convention is
  commentDensity: number;         // comments per line of code
  commentStyle: 'descriptive' | 'terse' | 'mixed' | 'none';
  avgLineLength: number;
  lineVariance: number;           // standard deviation of line lengths
  whitespaceStyle: 'consistent' | 'varied';
  vocabularyRichness: number;     // unique tokens / total tokens
}

/** Structural patterns detected in code */
export interface StructuralFeatures {
  errorHandlingCompleteness: number;  // 0-1
  codeSymmetry: number;               // 0-1 how symmetric/parallel structures are
  boilerplateRatio: number;           // ratio of boilerplate to logic
  importOrganization: number;         // 0-1 how organized imports are
  functionLengthConsistency: number;  // 0-1
  nestingDepthVariance: number;
  todoPresence: boolean;              // humans leave TODOs, AI doesn't
  deadCodePresence: boolean;          // humans leave dead code, AI doesn't
}

/** Per-line forensic verdict */
export interface ForensicLineVerdict {
  line: number;
  content: string;
  verdict: 'ai' | 'human' | 'uncertain';
  confidence: number;
  signals: ForensicSignal[];
}

/** Complete forensic analysis result for a file */
export interface ForensicFileResult {
  filePath: string;
  overallVerdict: 'ai' | 'human' | 'mixed' | 'uncertain';
  aiPercentage: number;
  humanPercentage: number;
  confidence: number;
  lineVerdicts: ForensicLineVerdict[];
  signals: ForensicSignal[];
  analyzedAt: number;
}

/** Forensic analysis for an entire diff/pull */
export interface ForensicReport {
  files: ForensicFileResult[];
  overall: {
    aiPercentage: number;
    humanPercentage: number;
    totalLinesAnalyzed: number;
    confidence: number;
  };
  analyzedAt: number;
  sourceRef?: string;  // branch name or commit hash that was analyzed
}
