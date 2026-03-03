import { Heuristic, LineScore, AnalysisContext } from '../types.js';

const OBVIOUS_COMMENT_PATTERNS = [
  /\/\/\s*(loop|iterate)\s*(through|over)/i,
  /\/\/\s*return\s*(the\s*)?result/i,
  /\/\/\s*check\s*(if|whether)/i,
  /\/\/\s*set\s*(the\s*)?\w+\s*(to|=)/i,
  /\/\/\s*create\s*(a|an|the)?\s*(new\s*)?\w+/i,
  /\/\/\s*initialize/i,
  /\/\/\s*declare/i,
  /\/\/\s*import/i,
  /\/\/\s*export/i,
  /\/\/\s*define\s*(the\s*)?\w+/i,
  /\/\/\s*get\s*(the\s*)?\w+/i,
  /\/\/\s*call\s*(the\s*)?\w+/i,
  /\/\/\s*handle\s*(the\s*)?(error|exception)/i,
  /\/\/\s*add\s*(the\s*)?\w+\s*to/i,
  /\/\/\s*update\s*(the\s*)?\w+/i,
  /\/\/\s*delete\s*(the\s*)?\w+/i,
  /\/\/\s*remove\s*(the\s*)?\w+/i,
];

const HUMAN_COMMENT_PATTERNS = [
  /\/\/\s*TODO/i,
  /\/\/\s*FIXME/i,
  /\/\/\s*HACK/i,
  /\/\/\s*XXX/i,
  /\/\/\s*NOTE/i,
  /\/\/\s*WARN/i,
  /\/\/\s*BUG/i,
  /\/\/\s*WTF/i,
  /\/\/\s*why/i,
  /\/\/\s*workaround/i,
  /\/\/\s*this\s*(is\s*)?(a\s*)?hack/i,
  /\/\/\s*don'?t\s*(ask|touch|change)/i,
];

const COMMENT_RE = /^\s*\/\//;

export const commentsHeuristic: Heuristic = {
  name: 'comments',
  weight: 0.25,

  analyze(lines: string[], _context: AnalysisContext): LineScore[] {
    return lines.map((content, i) => {
      if (!COMMENT_RE.test(content)) {
        return { lineNumber: i + 1, content, aiProbability: 0.5, signals: [] };
      }

      for (const pattern of HUMAN_COMMENT_PATTERNS) {
        if (pattern.test(content)) {
          return {
            lineNumber: i + 1, content, aiProbability: 0.15,
            signals: [{ heuristic: 'comments', score: 0.15, reason: 'Human-style comment (TODO/FIXME/why)' }],
          };
        }
      }

      for (const pattern of OBVIOUS_COMMENT_PATTERNS) {
        if (pattern.test(content)) {
          return {
            lineNumber: i + 1, content, aiProbability: 0.85,
            signals: [{ heuristic: 'comments', score: 0.85, reason: 'Obvious/redundant comment describing WHAT' }],
          };
        }
      }

      // Check if comment just describes the next line
      const nextLine = lines[i + 1];
      if (nextLine) {
        const commentText = content.replace(/^\s*\/\/\s*/, '').toLowerCase().trim();
        const nextLower = nextLine.toLowerCase().trim();
        if (commentText.length > 3 && nextLower.includes(commentText.split(' ')[0])) {
          return {
            lineNumber: i + 1, content, aiProbability: 0.7,
            signals: [{ heuristic: 'comments', score: 0.7, reason: 'Comment mirrors next line' }],
          };
        }
      }

      return { lineNumber: i + 1, content, aiProbability: 0.5, signals: [] };
    });
  },
};
