import {
  defaultWindowsSetupFileName,
  githubReleaseInstallerDownloadUrl,
  GITHUB_UPDATE_OWNER,
  GITHUB_UPDATE_REPO,
} from '../constants/githubRelease';

export type GitHubReleaseInfo = {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
  tagName: string;
  publishedAt: string;
};

function parseVersionFromRelease(release: { tag_name?: string; name?: string }): string {
  const fromTag = String(release.tag_name ?? '')
    .trim()
    .replace(/^v/i, '');
  const tagMatch = fromTag.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
  if (tagMatch) return tagMatch[1];

  const fromName = String(release.name ?? '');
  const nameMatch = fromName.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/);
  return nameMatch ? nameMatch[1] : fromTag;
}

/** Latest desktop release from GitHub (public repo). */
export async function fetchLatestGitHubRelease(): Promise<GitHubReleaseInfo> {
  const apiUrl = `https://api.github.com/repos/${GITHUB_UPDATE_OWNER}/${GITHUB_UPDATE_REPO}/releases/latest`;
  const res = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub releases API failed (${res.status}). Check repo ${GITHUB_UPDATE_OWNER}/${GITHUB_UPDATE_REPO}.`);
  }

  const data = (await res.json()) as {
    tag_name?: string;
    name?: string;
    body?: string;
    published_at?: string;
    assets?: Array<{ name?: string; browser_download_url?: string }>;
  };

  const version = parseVersionFromRelease(data);
  if (!version) throw new Error('Could not read version from latest GitHub release.');

  const assets = Array.isArray(data.assets) ? data.assets : [];
  const exeAsset = assets.find(
    (a) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.exe')
  );
  const downloadUrl =
    String(exeAsset?.browser_download_url ?? '').trim() ||
    githubReleaseInstallerDownloadUrl(version, defaultWindowsSetupFileName(version));

  return {
    version,
    downloadUrl,
    releaseNotes: String(data.body ?? '').trim(),
    tagName: String(data.tag_name ?? ''),
    publishedAt: String(data.published_at ?? ''),
  };
}
