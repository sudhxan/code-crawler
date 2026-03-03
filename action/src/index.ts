import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadAllAuthorship } from '../../src/persistence.js';
import { generateCommitReport } from '../../src/reporter.js';
import type { FileAuthorship, AuthorshipSummary } from '../../src/types.js';

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

    // Read authorship data from .code-crawler/ directory
    const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd();
    const files = loadAllAuthorship(repoRoot);

    if (files.length === 0) {
      core.info('No Code Crawler authorship data found in repository.');
      return;
    }

    const overall = computeOverall(files);
    const aiPct = overall.aiPercentage;
    const humanPct = overall.humanPercentage;

    core.setOutput('ai_percentage', aiPct.toFixed(1));
    core.setOutput('human_percentage', humanPct.toFixed(1));

    if (postComment) {
      const markdown = generateCommitReport(files);
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

function computeOverall(files: FileAuthorship[]): AuthorshipSummary {
  let totalLines = 0, aiLines = 0, humanLines = 0, mixedLines = 0;
  for (const f of files) {
    totalLines += f.summary.totalLines;
    aiLines += f.summary.aiLines;
    humanLines += f.summary.humanLines;
    mixedLines += f.summary.mixedLines;
  }
  return {
    totalLines, aiLines, humanLines, mixedLines,
    aiPercentage: totalLines > 0 ? Math.round((aiLines / totalLines) * 100) : 0,
    humanPercentage: totalLines > 0 ? Math.round((humanLines / totalLines) * 100) : 0,
  };
}

run();
