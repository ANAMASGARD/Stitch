/**
 * Parse a GitHub pull request URL into owner, repo, and PR number (v1: PR URLs only).
 */

export type ParsedGithubPrUrl = {
  owner: string;
  repo: string;
  prNumber: number;
};

const PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/;

/**
 * Accepts https://github.com/{owner}/{repo}/pull/{n} (optional trailing slash, query, hash).
 * Rejects issue URLs and non-github.com hosts.
 */
export function parseGithubPrUrl(rawUrl: string): ParsedGithubPrUrl {
  const trimmed = rawUrl.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    throw new Error("Only github.com (or www.github.com) pull request URLs are supported");
  }

  const pathname = url.pathname.replace(/\/+$/, "") || url.pathname;
  const match = pathname.match(PR_PATH);
  if (!match) {
    if (/\/issues\/\d+/.test(pathname)) {
      throw new Error("Issue URLs are not supported; use a pull request URL (/pull/123)");
    }
    throw new Error(
      "Expected a URL like https://github.com/owner/repo/pull/123"
    );
  }

  const owner = match[1];
  const repo = match[2];
  const prNumber = Number.parseInt(match[3], 10);
  if (!owner || !repo || !Number.isFinite(prNumber) || prNumber < 1) {
    throw new Error("Could not parse owner, repo, or pull number from URL");
  }

  return { owner, repo, prNumber };
}
