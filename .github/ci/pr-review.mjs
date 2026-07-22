import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const token = process.env.GITHUB_TOKEN;
const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
const prNumber = Number(process.env.PR_NUMBER);
const commentBody = process.env.COMMENT_BODY || '';
const commentUser = process.env.COMMENT_USER || '';
const maxDiffChars = 120_000;

function selectedProvider(body) {
  const providers = ['codex', 'claude'].filter((name) =>
    new RegExp(`(^|\\s)@${name}\\b`, 'i').test(body),
  );
  if (providers.length !== 1) {
    throw new Error('Use exactly one provider tag: @codex or @claude.');
  }
  return providers[0];
}

async function github(path, options = {}) {
  const response = await fetch(`${apiUrl}/${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${data?.message || text}`);
  }
  return data;
}

async function githubText(path, accept) {
  const response = await fetch(`${apiUrl}/${path}`, {
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${text}`);
  return text;
}

function postJson(path, body) {
  return github(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function loadReviewContract() {
  const root = process.cwd();
  const contract = readFileSync(join(root, '.github/ci/pr-review.md'), 'utf8');
  const ruleFiles = walk(join(root, 'docs/rules'))
    .filter((path) => path.endsWith('.md'))
    .sort()
    .map((path) => `## ${relative(root, path)}\n${readFileSync(path, 'utf8')}`)
    .join('\n\n');
  return `${contract}\n\n# Repository rules\n${ruleFiles}`;
}

function providerText(response) {
  if (response.output_text) return response.output_text;
  if (Array.isArray(response.content)) {
    return response.content.filter((item) => item.type === 'text').map((item) => item.text).join('\n');
  }
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text' || item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

function parseReview(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Provider did not return JSON.');
  const review = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(review.findings)) throw new Error('Review JSON has no findings array.');
  return {
    summary: String(review.summary || '검토가 완료되었습니다.'),
    findings: review.findings.map((finding) => ({
      severity: String(finding.severity || 'major').toLowerCase(),
      blocking: finding.blocking === true,
      file: String(finding.file || '변경 파일'),
      line: Number.isInteger(finding.line) ? finding.line : null,
      title: String(finding.title || '수정 필요'),
      body: String(finding.body || '구체적인 수정 내용이 필요합니다.'),
    })),
  };
}

function reviewIsBlocking(review) {
  return review.findings.some((finding) => finding.blocking);
}

function reviewMarkdown(provider, sha, review) {
  const decision = reviewIsBlocking(review) ? 'BLOCK' : 'PASS';
  const findings = review.findings.length === 0
    ? 'No actionable findings.'
    : review.findings.map((finding, index) => {
      const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
      const marker = finding.blocking ? 'BLOCKING' : finding.severity.toUpperCase();
      return `### ${index + 1}. [${marker}] ${finding.title}\n\`${location}\`\n\n${finding.body}`;
    }).join('\n\n');
  return `## ${provider} PR review — ${decision}\n\nReviewed commit: \`${sha.slice(0, 7)}\`\n\n${review.summary}\n\n${findings}`;
}

async function createCheck(sha, conclusion, reviewBody) {
  await postJson(`repos/${owner}/${repo}/check-runs`, {
    name: 'AI PR Review',
    head_sha: sha,
    status: 'completed',
    conclusion,
    output: {
      title: conclusion === 'failure' ? '수정 필요한 AI 리뷰 결과' : 'AI 리뷰 통과',
      summary: reviewBody.slice(0, 65_000),
    },
  });
}

async function createReview(pr, body, blocking) {
  try {
    await postJson(`repos/${owner}/${repo}/pulls/${pr.number}/reviews`, {
      commit_id: pr.head.sha,
      body,
      event: blocking ? 'REQUEST_CHANGES' : 'COMMENT',
    });
  } catch (error) {
    await postJson(`repos/${owner}/${repo}/issues/${pr.number}/comments`, {
      body: `${body}\n\n> GitHub review event could not be submitted: ${error.message}`,
    });
  }
}

async function callProvider(provider, model, input) {
  if (!model) throw new Error(`${provider.toUpperCase()}_MODEL repository variable is required.`);
  if (provider === 'codex') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY repository secret is required.');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`OpenAI API ${response.status}: ${data.error?.message || 'request failed'}`);
    return providerText(data);
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY repository secret is required.');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'user', content: input }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Anthropic API ${response.status}: ${data.error?.message || 'request failed'}`);
  return providerText(data);
}

async function main() {
  const provider = selectedProvider(commentBody);
  const pr = await github(`repos/${owner}/${repo}/pulls/${prNumber}`);
  const permission = await github(`repos/${owner}/${repo}/collaborators/${encodeURIComponent(commentUser)}/permission`);
  if (!['write', 'maintain', 'admin'].includes(permission.permission)) {
    await postJson(`repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      body: `@${commentUser} AI 리뷰는 저장소 write 권한 이상인 사용자만 실행할 수 있습니다.`,
    });
    return;
  }

  const contract = loadReviewContract();
  const rawDiff = await githubText(
    `repos/${owner}/${repo}/pulls/${prNumber}`,
    'application/vnd.github.v3.diff',
  );
  const diff = rawDiff.length > maxDiffChars
    ? `${rawDiff.slice(0, maxDiffChars)}\n\n[DIFF TRUNCATED: review is incomplete]`
    : rawDiff;
  const input = `${contract}\n\n# Pull request\n${pr.title}\nBase: ${pr.base.sha}\nHead: ${pr.head.sha}\n\n# Diff\n${diff}`;
  const model = provider === 'codex' ? process.env.CODEX_MODEL : process.env.CLAUDE_MODEL;

  try {
    const review = parseReview(await callProvider(provider, model, input));
    const blocking = reviewIsBlocking(review);
    const body = reviewMarkdown(provider, pr.head.sha, review);
    await createReview(pr, body, blocking);
    await createCheck(pr.head.sha, blocking ? 'failure' : 'success', body);
    if (blocking) process.exitCode = 1;
  } catch (error) {
    const body = `## ${provider} PR review failed\n\n${error.message}`;
    await postJson(`repos/${owner}/${repo}/issues/${prNumber}/comments`, { body });
    await createCheck(pr.head.sha, 'failure', body);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
