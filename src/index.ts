export { classifyEdit } from './classifier.js';
export type { ClassificationInput, Classification } from './classifier.js';
export { AuthorshipMap } from './authorship-map.js';
export { saveFileAuthorship, loadFileAuthorship, loadAllAuthorship } from './persistence.js';
export { generateFileReport, generateCommitReport } from './reporter.js';
export type {
  EditEvent, EditChange, EditClassification,
  LineAuthorship, FileAuthorship, AuthorshipSummary, CommitReport,
} from './types.js';

// Forensics: static analysis for external code
export { ForensicSupervisor, saveLedger, loadLedger } from './forensics/supervisor.js';
export type {
  ForensicSignal, ForensicFileResult, ForensicReport,
} from './forensics/types.js';

// Fingerprinting: invisible commit-level authorship tracking
export {
  buildFingerprint, encodeFingerprint, decodeFingerprint,
  injectTrailer, extractTrailer, readFingerprintsFromLog,
} from './fingerprint.js';
export type { CommitFingerprint, FileFingerprint } from './fingerprint.js';

// Hook installer: git hooks for automatic fingerprinting
export { installHooks, uninstallHooks, checkHooks } from './hook-installer.js';

// Pull analyzer: analyze pulled code with fingerprint + forensic fallback
export { analyzePull, formatPullAnalysis } from './pull-analyzer.js';
export type { PullAnalysisResult, PullFileResult } from './pull-analyzer.js';
