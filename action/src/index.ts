import * as core from '@actions/core';
import * as github from '@actions/github';
import { CodeCrawlerDetector } from '../../src/analyzer/detector.js';
import type { AnalysisResult } from '../../src/analyzer/types.js';

async function run(): Promise<void> {
  try {
    const threshold = parseFloat(core.getInput('threshold') || '0.5');
    const postComment = core.getInput('comment') !== 'false';

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      core.setFailed('GITHUB_TOKEN is required');
      return;
    }

    const octokit = github.getOctokit(token);
    const { context } = github;

    if (!context.payload.pull_request) {
      core.info('Not a pull request event, skipping.');
      return;
    }

    const prNumber = context.payload.pull_request.number;

    const { data: diff } = await octokit.rest.pulls.get({
      ...context.repo,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    });

    const detector = new CodeCrawlerDetector();
    const results = await detector.analyzeDiff(diff as unknown as string);

    const { markdown, aiPct, humanPct } = buildSummary(results, threshold);

    core.setOutput('ai_percentage', aiPct.toFixed(1));
    core.setOutput('human_percentage', humanPct.toFixed(1));

    if (postComment) {
      const body = `## Code Crawler Analysis\n\n${markdown}`;

      const { data: comments } = await octokit.rest.issues.listComments({
        ...context.repo,
        issue_number: prNumber,
      });

      const existing = comments.find(
        (c) => c.body?.startsWith('## Code Crawler Analysis'),
      );

      if (existing) {
        await octokit.rest.issues.updateComment({
          ...context.repo,
          comment_id: existing.id,
          body,
        });
      } else {
        await octokit.rest.issues.createComment({
          ...context.repo,
          issue_number: prNumber,
          body,
        });
      }
    }

    if (aiPct > threshold * 100) {
      core.warning(
        `AI-written code detected: ${aiPct.toFixed(1)}% exceeds threshold of ${(threshold * 100).toFixed(0)}%`,
      );
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

function buildSummary(
  results: AnalysisResult[],
  threshold: number,
): { markdown: string; aiPct: number; humanPct: number } {
  if (results.length === 0) {
    return { markdown: 'No files analyzed.', aiPct: 0, humanPct: 100 };
  }

  const rows = results.map((r) => {
    const flag = r.summary.aiPercentage / 100 > threshold ? ' :warning:' : '';
    return `| \`${r.filePath}\` | ${r.summary.aiPercentage.toFixed(1)}% | ${r.summary.humanPercentage.toFixed(1)}% | ${(r.summary.confidence * 100).toFixed(0)}% |${flag}`;
  });

  const totalLines = results.reduce((s, r) => s + r.summary.totalLines, 0);
  const totalAiLines = results.reduce((s, r) => s + r.summary.aiLines, 0);
  const aiPct = totalLines > 0 ? (totalAiLines / totalLines) * 100 : 0;
  const humanPct = 100 - aiPct;

  const markdown = [
    '| File | AI % | Human % | Confidence | |',
    '|------|------|---------|------------|---|',
    ...rows,
    '',
    `**Overall: ${aiPct.toFixed(1)}% AI-written, ${humanPct.toFixed(1)}% Human-written** (${results.length} files, ${totalLines} lines)`,
    '',
    `> Threshold: ${(threshold * 100).toFixed(0)}%`,
  ].join('\n');

  return { markdown, aiPct, humanPct };
}

run();
