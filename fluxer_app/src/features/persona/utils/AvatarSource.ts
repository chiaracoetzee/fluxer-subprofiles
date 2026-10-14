// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Fork: whether an avatar value is a media hash (to be turned into a media-proxy URL) rather than
 * an address that is already usable as it is.
 *
 * Persona and profile code passes both kinds through the same props. An address can be absolute
 * (`https://…`, `data:`, `blob:`) or relative: the bundled default avatars are `/assets/….png` in a
 * production build, where the public path is `/`. Treating a relative address as a hash produced
 * `/media/avatars/<id>//assets/….png.webp`, a 404, so accounts without an avatar showed an empty
 * placeholder on production while the dev server, whose asset addresses are absolute, looked fine.
 * Media hashes are letters, digits, `_` and `-` only (an animated hash starts with `a_`).
 */
export function isAvatarMediaHash(value: string): boolean {
	return /^[A-Za-z0-9_-]+$/.test(value);
}
