export interface AnalysisResult {
  filePath: string;
  overallScore: number;
  lineScores: LineScore[];
  summary: AnalysisSummary;
}

export interface LineScore {
  lineNumber: number;
  content: string;
  aiProbability: number;
  signals: Signal[];
}

export interface Signal {
  heuristic: string;
  score: number;
  reason: string;
}

export interface AnalysisSummary {
  totalLines: number;
  aiLines: number;
  humanLines: number;
  aiPercentage: number;
  humanPercentage: number;
  confidence: number;
}

export interface Heuristic {
  name: string;
  weight: number;
  analyze(lines: string[], context: AnalysisContext): LineScore[];
}

export interface AnalysisContext {
  filePath: string;
  language: string;
  fullContent: string;
  gitInfo?: GitInfo;
}

export interface GitInfo {
  commitSize: number;
  addedLines: number;
  isNewFile: boolean;
  commitMessage: string;
  timeSinceLastCommit?: number;
}
