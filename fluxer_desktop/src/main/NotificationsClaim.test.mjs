// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {describe, test, beforeEach} from 'node:test';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

function transform(relativePath) {
	const sourcePath = fileURLToPath(new URL(relativePath, import.meta.url));
	const code = esbuild.transformSync(fs.readFileSync(sourcePath, 'utf8'), {
		loader: 'ts',
		format: 'cjs',
		platform: 'node',
		target: 'node20',
	}).code;
	return {sourcePath, code};
}

const notificationsIpcSource = transform('./NotificationsIpc.ts');
const silentLog = {debug() {}, info() {}, warn() {}, error() {}};

function runModule({sourcePath, code}, requireStub) {
	const module = {exports: {}};
	const context = vm.createContext({
		require: requireStub,
		module,
		exports: module.exports,
		process,
		console,
		URL,
		JSON,
		Date,
		Map,
		Set,
		Buffer,
	});
	vm.runInContext(code, context, {filename: sourcePath});
	return module.exports;
}

function loadNotificationsHarness() {
	const invokeHandlers = new Map();
	const eventHandlers = new Map();
	let focusedWindow = null;

	const mockBrowserWindow = {
		getFocusedWindow: () => focusedWindow,
	};

	const ipcMainMock = {
		handle: (name, handler) => {
			invokeHandlers.set(name, handler);
		},
		on: (name, handler) => {
			eventHandlers.set(name, handler);
		},
	};

	const notificationsIpc = runModule(notificationsIpcSource, (specifier) => {
		if (specifier === 'electron') {
			return {
				BrowserWindow: mockBrowserWindow,
				ipcMain: ipcMainMock,
				Notification: {isSupported: () => true},
				nativeImage: {},
			};
		}
		if (specifier === 'node:module') {
			return {createRequire: () => () => ({})};
		}
		if (specifier === '@electron/common/DesktopIdentity') {
			return {DESKTOP_APP_NAME: 'Fluxer', LINUX_DESKTOP_ENTRY_ID: 'fluxer'};
		}
		if (specifier === '@electron/common/Logger') {
			return {createChildLogger: () => silentLog};
		}
		if (specifier === '@electron/main/LaunchOptions') {
			return {getNativeNotificationsMode: () => 'electron'};
		}
		if (specifier === '@electron/main/MainI18n') {
			return {t: (s) => s};
		}
		if (specifier === '@electron/main/NotificationIcon') {
			return {resolveNotificationIcon: async () => null};
		}
		if (specifier === '@electron/main/NotificationState') {
			return {shouldPlayNotificationSound: async () => true};
		}
		if (specifier === '@electron/main/PrivilegedRendererDocuments') {
			return {requirePrivilegedRendererDocumentSender: () => {}};
		}
		throw new Error(`Unexpected import in test: ${specifier}`);
	});

	notificationsIpc.resetNotificationClaimsForTesting();
	notificationsIpc.registerNotificationIpcHandlers(() => null);

	return {
		claimNotification: (senderId, messageId, channelId) => {
			const handler = invokeHandlers.get('claim-notification-for-sound');
			return handler({sender: {id: senderId}}, messageId, channelId);
		},
		setFocusedChannel: (senderId, channelId) => {
			const handler = eventHandlers.get('set-focused-channel');
			handler({sender: {id: senderId}}, channelId);
		},
		setFocusedWindow: (win) => {
			focusedWindow = win;
		},
		reset: () => {
			notificationsIpc.resetNotificationClaimsForTesting();
		},
	};
}

describe('Notification multi-window claim and sound gate', () => {
	test('only the first window to claim a message gets true', () => {
		const harness = loadNotificationsHarness();

		const win1Claim = harness.claimNotification(1, 'msg-100', 'chan-1');
		assert.equal(win1Claim, true, 'Window 1 should succeed claiming unclaimed message');

		const win2Claim = harness.claimNotification(2, 'msg-100', 'chan-1');
		assert.equal(win2Claim, false, 'Window 2 should be rejected for already claimed message');

		const win3Claim = harness.claimNotification(3, 'msg-100', 'chan-1');
		assert.equal(win3Claim, false, 'Window 3 should also be rejected for already claimed message');
	});

	test('different messages can be claimed independently', () => {
		const harness = loadNotificationsHarness();

		assert.equal(harness.claimNotification(1, 'msg-1', 'chan-1'), true);
		assert.equal(harness.claimNotification(2, 'msg-2', 'chan-1'), true);
		assert.equal(harness.claimNotification(1, 'msg-1', 'chan-1'), false);
		assert.equal(harness.claimNotification(2, 'msg-2', 'chan-1'), false);
	});

	test('suppresses background notification if another window is focused on that exact channel', () => {
		const harness = loadNotificationsHarness();

		// Window 1 is focused in OS and viewing 'chan-active'
		harness.setFocusedWindow({
			webContents: {id: 1},
		});
		harness.setFocusedChannel(1, 'chan-active');

		// Window 2 (unfocused background window) receives message in 'chan-active'
		const win2ClaimActive = harness.claimNotification(2, 'msg-active', 'chan-active');
		assert.equal(
			win2ClaimActive,
			false,
			'Window 2 should be suppressed because Window 1 is actively focused on chan-active',
		);

		// But for a different channel 'chan-other', Window 2 CAN claim
		const win2ClaimOther = harness.claimNotification(2, 'msg-other', 'chan-other');
		assert.equal(
			win2ClaimOther,
			true,
			'Window 2 should be allowed to claim for a channel not currently focused',
		);
	});

	test('allows notification once focused window blurs or changes channel', () => {
		const harness = loadNotificationsHarness();

		// Window 1 is focused on chan-A
		harness.setFocusedWindow({
			webContents: {id: 1},
		});
		harness.setFocusedChannel(1, 'chan-A');

		// Window 2 tries to claim message in chan-A -> blocked
		assert.equal(harness.claimNotification(2, 'msg-A1', 'chan-A'), false);

		// Window 1 switches to chan-B
		harness.setFocusedChannel(1, 'chan-B');

		// Now Window 2 receives a new message in chan-A -> allowed!
		assert.equal(harness.claimNotification(2, 'msg-A2', 'chan-A'), true);

		// When no window is focused in OS (e.g. user switched to browser)
		harness.setFocusedWindow(null);
		harness.setFocusedChannel(1, null);

		// Window 2 can claim messages in chan-B too
		assert.equal(harness.claimNotification(2, 'msg-B1', 'chan-B'), true);
	});

	test('prunes oldest claims when exceeding CLAIM_CACHE_MAX (500)', () => {
		const harness = loadNotificationsHarness();

		// Claim 500 messages
		for (let i = 0; i < 500; i++) {
			assert.equal(harness.claimNotification(1, `msg-${i}`), true);
		}

		// msg-0 was the first claimed
		assert.equal(harness.claimNotification(2, 'msg-0'), false);

		// Claim 1 more to trigger pruning of excess
		assert.equal(harness.claimNotification(1, 'msg-500'), true);

		// msg-0 should have been pruned as the oldest entry
		assert.equal(harness.claimNotification(2, 'msg-0'), true);
	});
});
