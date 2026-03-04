import { Heuristic } from '../types.js';
import { namingHeuristic } from './naming.js';
import { commentsHeuristic } from './comments.js';
import { structureHeuristic } from './structure.js';
import { entropyHeuristic } from './entropy.js';
import { gitSignalsHeuristic } from './git-signals.js';
import { repetitionHeuristic } from './repetition.js';
import { completenessHeuristic } from './completeness.js';

export const allHeuristics: Heuristic[] = [
  namingHeuristic,
  commentsHeuristic,
  structureHeuristic,
  entropyHeuristic,
  gitSignalsHeuristic,
  repetitionHeuristic,
  completenessHeuristic,
];
