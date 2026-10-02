// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash} from 'node:crypto';
import {createWriteStream, mkdtempSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {app} from 'electron';
import log from 'electron-log';

const GITHUB_REPO = 'chiaracoetzee/fluxer-subprofiles';
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;
const RELEASE_TAG_PREFIX = 'desktop-v';

export const GITHUB_RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

export type GitHubReleaseAsset = {
	name: string;
	browser_download_url: string;
	size: number;
};

export type GitHubRelease = {
	tag_name: string;
	version: string;
	assets: Array<GitHubReleaseAsset>;
};

export type DesktopUpdateMode = 'nsis' | 'portable' | 'appimage';

export type ResolvedUpdateAsset = {
	version: string;
	downloadUrl: string;
	size: number;
	fileName: string;
	sha256: string | null;
};

type DownloadProgress = {
	percent: number;
	transferred: number;
	total: number;
	bytesPerSecond: number;
};

export type StagedDownload = {
	filePath: string;
	stagingDirectory: string;
	version: string;
};

// ETag cache to avoid burning GitHub API rate limits (60/hr unauthenticated)
let cachedETag: string | null = null;
let cachedRelease: GitHubRelease | null = null;

const ASSET_PATTERNS: Record<DesktopUpdateMode, RegExp> = {
	nsis: /Setup-.*-win-x64\.exe$/i,
	portable: /-portable-.*-win-x64\.exe$/i,
	appimage: /-Linux-x86_64\.AppImage$/i,
};

function parseVersionFromTag(tagName: string): string | null {
	if (!tagName.startsWith(RELEASE_TAG_PREFIX)) {
		return null;
	}
	return tagName.slice(RELEASE_TAG_PREFIX.length);
}

export async function fetchLatestDesktopRelease(forceRefresh = false): Promise<GitHubRelease | null> {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'User-Agent': `Fluxer-Desktop/${app.getVersion()}`,
		'X-GitHub-Api-Version': '2022-11-28',
	};

	if (!forceRefresh && cachedETag) {
		headers['If-None-Match'] = cachedETag;
	}

	const url = `${GITHUB_API_BASE}/releases?per_page=10`;
	const response = await fetch(url, {headers, cache: 'no-store'});

	if (response.status === 304 && cachedRelease) {
		return cachedRelease;
	}

	if (!response.ok) {
		throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
	}

	const etag = response.headers.get('etag');
	if (etag) {
		cachedETag = etag;
	}

	const releases = (await response.json()) as Array<{tag_name: string; assets: Array<GitHubReleaseAsset>}>;

	// Find the latest release with our desktop tag prefix
	for (const release of releases) {
		const version = parseVersionFromTag(release.tag_name);
		if (version) {
			const parsed: GitHubRelease = {
				tag_name: release.tag_name,
				version,
				assets: release.assets,
			};
			cachedRelease = parsed;
			return parsed;
		}
	}

	return null;
}

export function resolveDesktopAsset(release: GitHubRelease, mode: DesktopUpdateMode): GitHubReleaseAsset | null {
	const pattern = ASSET_PATTERNS[mode];
	return release.assets.find((asset) => pattern.test(asset.name)) ?? null;
}

export async function fetchSha256ForAsset(
	release: GitHubRelease,
	assetFileName: string,
): Promise<string | null> {
	const checksumsAsset = release.assets.find((a) => a.name === 'SHA256SUMS.txt');
	if (!checksumsAsset) {
		return null;
	}

	const response = await fetch(checksumsAsset.browser_download_url, {cache: 'no-store'});
	if (!response.ok) {
		log.warn('Failed to fetch SHA256SUMS.txt', {status: response.status});
		return null;
	}

	const text = await response.text();
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		// Format: "<hash>  <filename>" or "<hash> <filename>"
		const match = trimmed.match(/^([0-9a-f]{64})\s+(.+)$/);
		if (match && match[2].trim() === assetFileName) {
			return match[1];
		}
	}

	return null;
}

export async function downloadAssetToStaging(
	asset: GitHubReleaseAsset,
	expectedSha256: string | null,
	onProgress?: (progress: DownloadProgress) => void,
): Promise<StagedDownload> {
	const stagingDirectory = mkdtempSync(join(tmpdir(), 'fluxer-update-'));
	const filePath = join(stagingDirectory, asset.name);

	try {
		const response = await fetch(asset.browser_download_url, {cache: 'no-store', redirect: 'follow'});
		if (!response.ok || response.body == null) {
			throw new Error(`Download failed: ${response.status}`);
		}

		const total = asset.size;
		let transferred = 0;
		let lastSampleAt = Date.now();
		let lastSampleTransferred = 0;
		let smoothedBytesPerSecond = 0;

		const hash = createHash('sha256');
		const writeStream = createWriteStream(filePath);

		const reader = response.body.getReader();

		// Stream the download, computing hash and reporting progress simultaneously
		const readable = new Readable({
			async read() {
				try {
					const {done, value} = await reader.read();
					if (done) {
						this.push(null);
						return;
					}
					hash.update(value);
					transferred += value.byteLength;

					const now = Date.now();
					const dtMs = now - lastSampleAt;
					const complete = total > 0 && transferred >= total;
					if (dtMs >= 500 || complete) {
						if (dtMs > 0 && transferred >= lastSampleTransferred) {
							const instant = ((transferred - lastSampleTransferred) * 1000) / dtMs;
							smoothedBytesPerSecond =
								smoothedBytesPerSecond === 0 ? instant : smoothedBytesPerSecond * 0.7 + instant * 0.3;
						}
						lastSampleAt = now;
						lastSampleTransferred = transferred;
						onProgress?.({
							percent: total > 0 ? Math.min(100, (transferred / total) * 100) : 0,
							transferred,
							total,
							bytesPerSecond: Math.round(smoothedBytesPerSecond),
						});
					}
					this.push(value);
				} catch (error) {
					this.destroy(error instanceof Error ? error : new Error(String(error)));
				}
			},
		});

		await pipeline(readable, writeStream);

		// Verify SHA-256 if we have an expected checksum
		if (expectedSha256) {
			const actualSha256 = hash.digest('hex');
			if (actualSha256 !== expectedSha256.toLowerCase()) {
				throw new Error(
					`SHA-256 checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`,
				);
			}
			log.info('SHA-256 checksum verified for downloaded update asset', {fileName: asset.name});
		}

		// Verify file size
		const downloadedSize = statSync(filePath).size;
		if (total > 0 && downloadedSize < total) {
			throw new Error(`Download incomplete: got ${downloadedSize} of ${total} bytes`);
		}

		return {filePath, stagingDirectory, version: ''};
	} catch (error) {
		// Clean up on failure
		try {
			rmSync(stagingDirectory, {recursive: true, force: true});
		} catch {}
		throw error;
	}
}

export function discardStagedDownload(staged: StagedDownload): void {
	try {
		rmSync(staged.stagingDirectory, {recursive: true, force: true});
	} catch {}
}
