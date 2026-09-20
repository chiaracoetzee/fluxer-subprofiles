// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

vi.hoisted(() => {
	const HARNESS_ENDPOINT = 'https://primary.test/api';
	const host = globalThis as unknown as {window?: Record<string, unknown>};
	if (typeof host.window === 'undefined') {
		host.window = host as unknown as Record<string, unknown>;
	}
	host.window.__FLUXER_BOOTSTRAP__ = {
		config: {
			releaseChannel: 'stable',
			bootstrapApiEndpoint: HARNESS_ENDPOINT,
			bootstrapApiPublicEndpoint: HARNESS_ENDPOINT,
		},
		instance: {
			api_code_version: Number.MAX_SAFE_INTEGER,
			endpoints: {
				api: HARNESS_ENDPOINT,
				api_client: HARNESS_ENDPOINT,
				api_public: HARNESS_ENDPOINT,
				gateway: 'wss://gateway.primary.test',
				media: 'https://media.primary.test',
				static_cdn: 'https://cdn.primary.test',
				marketing: 'https://primary.test',
				admin: 'https://admin.primary.test',
				invite: 'https://primary.test/invite',
				gift: 'https://primary.test/gift',
				webapp: 'https://app.primary.test',
				upload_relay: 'https://upload.primary.test',
			},
			captcha: {provider: 'none', hcaptcha_site_key: null, turnstile_site_key: null},
			features: {
				voice_enabled: false,
				stripe_enabled: false,
				self_hosted: false,
				presigned_attachment_uploads: false,
				emails_enabled: false,
			},
			gif: {provider: 'klipy', display_name: 'Klipy', attribution_required: false},
			sso: {enabled: false, enforced: false, display_name: null, redirect_uri: ''},
			registration: {mode: 'open', admin_registration_urls_enabled: true},
			community: {single_community: false, single_community_guild_id: null, direct_messages_disabled: false},
			services: {gif_enabled: true, youtube_enabled: false, bluesky_enabled: false},
			limits: undefined,
			push: {public_vapid_key: null},
			app_public: {
				branding: {
					product_name: 'Fluxer',
					icon_url: null,
					symbol_url: null,
					logo_url: null,
					wordmark_url: null,
				},
				custom_links: [],
			},
		},
	};
});

vi.mock('@lingui/core/macro', () => ({msg: (descriptor: unknown) => descriptor}));
vi.mock('@lingui/react/macro', () => ({
	Trans: ({children}: {children: unknown}) => children,
}));

describe('Idle dynamic inactivity timer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(async () => {
		const {default: Idle} = await import('./Idle');
		Idle.destroy();
		vi.useRealTimers();
		vi.resetModules();
	});

	it('allows dynamic configuration of idle duration', async () => {
		const {default: Idle} = await import('./Idle');

		// Set to 60 seconds (1 minute AFK timeout)
		Idle.setIdleDuration(60_000);
		expect(Idle.getIdleDuration()).toBe(60_000);

		// Record activity at t=0
		Idle.recordActivity();
		expect(Idle.isIdle()).toBe(false);
		expect(Idle.getIdleSince()).toBe(0);

		// Advance 30 seconds - should still NOT be idle
		vi.advanceTimersByTime(30_000);
		expect(Idle.isIdle()).toBe(false);

		// Advance past 60 seconds - should become idle
		vi.advanceTimersByTime(31_000);
		expect(Idle.isIdle()).toBe(true);
		expect(Idle.getIdleSince()).toBeGreaterThan(0);

		// Record activity should immediately clear idle
		Idle.recordActivity();
		expect(Idle.isIdle()).toBe(false);
		expect(Idle.getIdleSince()).toBe(0);
	});

	it('markBackground sets positive idleSince satisfying idle duration', async () => {
		const {default: Idle} = await import('./Idle');

		Idle.setIdleDuration(60_000);
		Idle.markBackground();

		expect(Idle.isIdle()).toBe(true);
		const idleSince = Idle.getIdleSince();
		expect(idleSince).toBeGreaterThan(0);
		expect(Date.now() - idleSince).toBeGreaterThanOrEqual(60_000);
	});

	it('syncs afkTimeout to Idle when setLocalPresenceUserSettings is called', async () => {
		const {default: Idle} = await import('./Idle');
		const {setLocalPresenceUserSettings} = await import(
			'@app/features/presence/state/LocalPresence'
		);

		const fakeSettings = {
			status: 'online',
			isHydrated: () => true,
			markSessionChanging: () => {},
			getAfkTimeout: () => 120, // 2 minutes
			getCustomStatus: () => null,
			getStatusResetsAt: () => null,
			getStatusResetsTo: () => null,
		};

		setLocalPresenceUserSettings(fakeSettings as any);
		expect(Idle.getIdleDuration()).toBe(120_000);
	});
});
