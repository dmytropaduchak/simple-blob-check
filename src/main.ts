import * as core from "@actions/core";
import * as github from "@actions/github";
import { scanBlobs, type Finding } from "./rules";

const MARKER = "<!-- simple-blob-check -->";
const NAME = "Simple Blob Check";

function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return [MARKER, `## ${NAME}`, "", "No oversized blobs found."].join("\n");
  }
  const rows = findings
    .map((f) => `| ${f.severity} | \`${f.ruleId}\` | ${f.file} | ${f.title} — ${f.detail} |`)
    .join("\n");
  return [
    MARKER,
    `## ${NAME}`,
    "",
    `Found **${findings.length}** issue(s).`,
    "",
    "| Severity | Rule | Location | Detail |",
    "| --- | --- | --- | --- |",
    rows,
  ].join("\n");
}

async function upsertPrComment(token: string, body: string): Promise<void> {
  const { context } = github;
  if (context.eventName !== "pull_request" && context.eventName !== "pull_request_target") return;
  const issue_number = context.payload.pull_request?.number;
  if (!issue_number) return;
  const octokit = github.getOctokit(token);
  const { data: comments } = await octokit.rest.issues.listComments({ ...context.repo, issue_number });
  const existing = comments.find((c) => c.body?.includes(MARKER));
  if (existing) {
    await octokit.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
    return;
  }
  await octokit.rest.issues.createComment({ ...context.repo, issue_number, body });
}

async function run(): Promise<void> {
  const token = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
  const failOn = (core.getInput("fail-on") || "none").toLowerCase();
  const maxBytes = Number(core.getInput("max-bytes") || "512000");
  const maxAdditions = Number(core.getInput("max-additions") || "200");
  if (!token) {
    core.setFailed("github-token is required");
    return;
  }
  const pr = github.context.payload.pull_request?.number;
  if (!pr) {
    core.setFailed("No pull request in context");
    return;
  }
  const octokit = github.getOctokit(token);
  const files: Array<{ filename: string; status: string; additions: number; changes: number; size?: number }> = [];
  for await (const resp of octokit.paginate.iterator(octokit.rest.pulls.listFiles, {
    ...github.context.repo,
    pull_number: pr,
    per_page: 100,
  })) {
    for (const f of resp.data) {
      files.push({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        changes: f.changes,
        size: (f as { size?: number }).size,
      });
    }
  }
  const findings = scanBlobs(files, maxBytes, maxAdditions);
  const summary = formatFindings(findings);
  await core.summary.addRaw(summary, true).write();
  for (const f of findings) {
    if (f.severity === "high") core.error(`${f.title} (${f.ruleId})`);
    else core.warning(`${f.title} (${f.ruleId})`);
  }
  try {
    await upsertPrComment(token, summary);
  } catch (e) {
    core.warning(`Could not post PR comment: ${e instanceof Error ? e.message : String(e)}`);
  }
  core.setOutput("finding-count", String(findings.length));
  const shouldFail =
    failOn === "high"
      ? findings.some((f) => f.severity === "high")
      : failOn === "medium"
        ? findings.some((f) => f.severity === "high" || f.severity === "medium")
        : false;
  if (shouldFail) core.setFailed(`simple-blob-check: ${findings.length} finding(s)`);
  else core.info(`Done. ${findings.length} finding(s).`);
}

run().catch((e) => core.setFailed(e instanceof Error ? e.message : String(e)));
