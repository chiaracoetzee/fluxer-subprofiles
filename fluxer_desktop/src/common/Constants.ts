// SPDX-License-Identifier: AGPL-3.0-or-later

export const APP_PROTOCOL = 'fluxer';
export const DEFAULT_HOMESERVER_URL = 'https://temple.hypersystem.xyz';
export const DEV_HOMESERVER_URL = 'https://chat-dev.hypersystem.xyz';
export const DEFAULT_APP_URL = process.env.DEFAULT_APP_URL || DEFAULT_HOMESERVER_URL;
export const STABLE_APP_URL = 'https://web.fluxer.app';
export const CANARY_APP_URL = 'https://web.canary.fluxer.app';
export const STABLE_MIGRATED_APP_ORIGIN = 'https://fluxer.com';
export const CANARY_MIGRATED_APP_ORIGIN = 'https://canary.fluxer.com';
export const KNOWN_HOMESERVER_ORIGINS = [
	'https://temple.hypersystem.xyz',
	'https://chat-dev.hypersystem.xyz',
] as const;
export const MIGRATED_APP_ENTRY_PATH = '/app';
export const PASSKEY_RP_IDS = ['temple.hypersystem.xyz', 'chat-dev.hypersystem.xyz', 'fluxer.app', 'fluxer.com'] as const;
export const STATIC_CDN_URL = 'https://fluxerstatic.com';
export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;
export const MIN_WINDOW_WIDTH = 0;
export const MIN_WINDOW_HEIGHT = 0;
