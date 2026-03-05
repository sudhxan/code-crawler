import { ForensicSignal, StructuralFeatures } from './types.js';

/**
 * Extracts structural features from code to detect AI vs human authorship.
 */
export function extractStructuralFeatures(code: string): StructuralFeatures {
  const lines = code.split('\n');
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);

  return {
    errorHandlingCompleteness: computeErrorHandlingCompleteness(code),
    codeSymmetry: computeCodeSymmetry(code),
    boilerplateRatio: computeBoilerplateRatio(lines, nonEmptyLines),
    importOrganization: computeImportOrganization(lines),
    functionLengthConsistency: computeFunctionLengthConsistency(code),
    nestingDepthVariance: computeNestingDepthVariance(code),
    todoPresence: /\/\/\s*(TODO|FIXME|HACK|XXX)/i.test(code),
    deadCodePresence: /^\s*\/\/\s*(const |function |if |let |var |return |class )/m.test(code),
  };
}

function computeErrorHandlingCompleteness(code: string): number {
  const tryCatchCount = (code.match(/try\s*\{/g) || []).length;
  const throwableOps = [
    ...(code.match(/await\s+/g) || []),
    ...(code.match(/JSON\.parse/g) || []),
    ...(code.match(/\.readFile|\.writeFile|\.readdir|fs\./g) || []),
    ...(code.match(/fetch\s*\(/g) || []),
  ].length;

  if (throwableOps === 0) return 0.5;
  return Math.min(1, tryCatchCount / throwableOps);
}

function computeCodeSymmetry(code: string): number {
  // Extract function signatures and look for parallel patterns
  const funcSignatures = code.match(/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\()/g) || [];
  if (funcSignatures.length < 2) return 0;

  // Check if-else chains for structural similarity
  const ifBlocks = code.match(/if\s*\([^)]*\)\s*\{/g) || [];

  // Check for repeated structural patterns
  let symmetricPairs = 0;
  for (let i = 0; i < funcSignatures.length - 1; i++) {
    for (let j = i + 1; j < funcSignatures.length; j++) {
      const a = funcSignatures[i].replace(/\w+/g, '_');
      const b = funcSignatures[j].replace(/\w+/g, '_');
      if (a === b) symmetricPairs++;
    }
  }

  const maxPairs = (funcSignatures.length * (funcSignatures.length - 1)) / 2;
  const sigScore = maxPairs > 0 ? symmetricPairs / maxPairs : 0;
  const ifScore = ifBlocks.length > 3 ? Math.min(1, ifBlocks.length / 10) : 0;

  return Math.min(1, (sigScore + ifScore) / 2);
}

function computeBoilerplateRatio(lines: string[], nonEmptyLines: string[]): number {
  if (nonEmptyLines.length === 0) return 0;
  const boilerplate = nonEmptyLines.filter(l => {
    const t = l.trim();
    return t.startsWith('import ') || t.startsWith('export ') ||
      t.startsWith('type ') || t.startsWith('interface ') ||
      t.startsWith('from ') || /^export\s+(default\s+)?(?:type|interface)/.test(t);
  });
  return boilerplate.length / nonEmptyLines.length;
}

function computeImportOrganization(lines: string[]): number {
  const importLines = lines.filter(l => l.trim().startsWith('import '));
  if (importLines.length <= 1) return 0.5;

  let score = 0;

  // Check grouping: external (no ./) vs internal (./)
  const external: number[] = [];
  const internal: number[] = [];
  importLines.forEach((l, i) => {
    if (/from\s+['"]\./.test(l)) internal.push(i);
    else external.push(i);
  });

  // Are groups contiguous and external before internal?
  if (external.length > 0 && internal.length > 0) {
    const externalEnd = Math.max(...external);
    const internalStart = Math.min(...internal);
    if (externalEnd < internalStart) score += 0.4;
  } else {
    score += 0.2;
  }

  // Check alphabetical within groups
  const isAlphabetical = (arr: string[]) => {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].localeCompare(arr[i - 1]) < 0) return false;
    }
    return true;
  };
  if (isAlphabetical(importLines)) score += 0.3;

  // Check consistent spacing (all single-line or consistent style)
  const styles = importLines.map(l => l.includes('{') ? 'destructured' : 'default');
  const consistent = styles.every(s => s === styles[0]);
  if (consistent) score += 0.3;

  return Math.min(1, score);
}

function computeFunctionLengthConsistency(code: string): number {
  const funcLengths = extractFunctionLengths(code);
  if (funcLengths.length < 2) return 0.5;

  const mean = funcLengths.reduce((a, b) => a + b, 0) / funcLengths.length;
  const variance = funcLengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / funcLengths.length;
  const stdDev = Math.sqrt(variance);

  // Low std dev = consistent = AI-like. Map to 0-1 where low variance → high score
  return Math.max(0, 1 - stdDev / (mean || 1));
}

function computeNestingDepthVariance(code: string): number {
  const functions = extractFunctionBodies(code);
  if (functions.length < 2) return 0;

  const maxDepths = functions.map(body => {
    let max = 0, depth = 0;
    for (const ch of body) {
      if (ch === '{') { depth++; max = Math.max(max, depth); }
      else if (ch === '}') depth--;
    }
    return max;
  });

  const mean = maxDepths.reduce((a, b) => a + b, 0) / maxDepths.length;
  return maxDepths.reduce((sum, d) => sum + (d - mean) ** 2, 0) / maxDepths.length;
}

function extractFunctionLengths(code: string): number[] {
  return extractFunctionBodies(code).map(body => body.split('\n').length);
}

function extractFunctionBodies(code: string): string[] {
  const bodies: string[] = [];
  const funcStarts = /(?:function\s+\w+\s*\([^)]*\)|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>)\s*\{/g;
  let match;

  while ((match = funcStarts.exec(code)) !== null) {
    const start = match.index + match[0].length - 1;
    let depth = 1;
    let i = start + 1;
    while (i < code.length && depth > 0) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') depth--;
      i++;
    }
    bodies.push(code.slice(start, i));
  }
  return bodies;
}

/**
 * Analyzes structural features and returns forensic signals.
 */
export function analyzeStructuralSignals(features: StructuralFeatures, code: string): ForensicSignal[] {
  const signals: ForensicSignal[] = [];

  // 1. Error handling signal
  const tryCatchCount = (code.match(/try\s*\{/g) || []).length;
  const throwableOps = [
    ...(code.match(/await\s+/g) || []),
    ...(code.match(/JSON\.parse/g) || []),
    ...(code.match(/\.readFile|\.writeFile|\.readdir|fs\./g) || []),
    ...(code.match(/fetch\s*\(/g) || []),
  ].length;

  if (features.errorHandlingCompleteness > 0.8) {
    signals.push({
      name: 'errorHandling',
      score: 0.75,
      confidence: 0.5,
      evidence: [`${tryCatchCount}/${throwableOps} throwable operations have error handling`],
    });
  } else if (features.errorHandlingCompleteness < 0.3) {
    signals.push({
      name: 'errorHandling',
      score: 0.2,
      confidence: 0.5,
      evidence: [`${tryCatchCount}/${throwableOps} throwable operations have error handling`],
    });
  } else {
    signals.push({
      name: 'errorHandling',
      score: 0.5,
      confidence: 0.3,
      evidence: [`${tryCatchCount}/${throwableOps} throwable operations have error handling`],
    });
  }

  // 2. Code structure signal
  const highSymmetry = features.codeSymmetry > 0.7;
  const consistentFuncs = features.functionLengthConsistency > 0.7;
  if (highSymmetry && consistentFuncs) {
    signals.push({
      name: 'codeStructure',
      score: 0.8,
      confidence: 0.55,
      evidence: [
        `Code symmetry: ${features.codeSymmetry.toFixed(2)}`,
        `Function length consistency: ${features.functionLengthConsistency.toFixed(2)}`,
      ],
    });
  } else if (!highSymmetry && !consistentFuncs) {
    signals.push({
      name: 'codeStructure',
      score: 0.2,
      confidence: 0.55,
      evidence: [
        `Code symmetry: ${features.codeSymmetry.toFixed(2)}`,
        `Function length consistency: ${features.functionLengthConsistency.toFixed(2)}`,
      ],
    });
  } else {
    signals.push({
      name: 'codeStructure',
      score: 0.5,
      confidence: 0.4,
      evidence: [
        `Code symmetry: ${features.codeSymmetry.toFixed(2)}`,
        `Function length consistency: ${features.functionLengthConsistency.toFixed(2)}`,
      ],
    });
  }

  // 3. Completeness signal
  const highBoilerplate = features.boilerplateRatio > 0.15;
  const organizedImports = features.importOrganization > 0.7;
  const noTodos = !features.todoPresence;
  const noDeadCode = !features.deadCodePresence;

  const completenessFactors = [highBoilerplate, organizedImports, noTodos, noDeadCode];
  const completeCount = completenessFactors.filter(Boolean).length;

  if (completeCount >= 3) {
    signals.push({
      name: 'completeness',
      score: 0.85,
      confidence: 0.6,
      evidence: [
        `Boilerplate ratio: ${features.boilerplateRatio.toFixed(2)}`,
        `Import organization: ${features.importOrganization.toFixed(2)}`,
        `TODOs present: ${features.todoPresence}`,
        `Dead code present: ${features.deadCodePresence}`,
      ],
    });
  } else if (completeCount <= 1) {
    signals.push({
      name: 'completeness',
      score: 0.15,
      confidence: 0.6,
      evidence: [
        `Boilerplate ratio: ${features.boilerplateRatio.toFixed(2)}`,
        `Import organization: ${features.importOrganization.toFixed(2)}`,
        `TODOs present: ${features.todoPresence}`,
        `Dead code present: ${features.deadCodePresence}`,
      ],
    });
  } else {
    signals.push({
      name: 'completeness',
      score: 0.5,
      confidence: 0.4,
      evidence: [
        `Boilerplate ratio: ${features.boilerplateRatio.toFixed(2)}`,
        `Import organization: ${features.importOrganization.toFixed(2)}`,
        `TODOs present: ${features.todoPresence}`,
        `Dead code present: ${features.deadCodePresence}`,
      ],
    });
  }

  // 4. Human artifacts signal
  if (features.todoPresence) {
    signals.push({
      name: 'humanArtifacts',
      score: 0.1,
      confidence: 0.7,
      evidence: ['TODO/FIXME/HACK/XXX comments found in code'],
    });
  } else if (features.deadCodePresence) {
    signals.push({
      name: 'humanArtifacts',
      score: 0.15,
      confidence: 0.6,
      evidence: ['Commented-out code detected'],
    });
  } else {
    signals.push({
      name: 'humanArtifacts',
      score: 0.55,
      confidence: 0.4,
      evidence: ['No TODO comments or dead code found'],
    });
  }

  return signals;
}
