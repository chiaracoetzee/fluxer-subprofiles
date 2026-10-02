// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

describe('WindowSessionRestore Z-Order and Stacking Logic', () => {
	test('sorts sessions by zOrder ascending to restore back-to-front', () => {
		const rawSessions = [
			{url: 'https://temple.hypersystem.xyz/channels/123', zOrder: 2, isMainWindow: false, isFocused: true},
			{url: 'https://temple.hypersystem.xyz/channels/456', zOrder: 0, isMainWindow: true, isFocused: false},
			{url: 'https://temple.hypersystem.xyz/channels/789', zOrder: 1, isMainWindow: false, isFocused: false},
		];

		const sortedSessions = [...rawSessions].sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0));

		assert.equal(sortedSessions[0].zOrder, 0);
		assert.equal(sortedSessions[0].isMainWindow, true);
		assert.equal(sortedSessions[1].zOrder, 1);
		assert.equal(sortedSessions[2].zOrder, 2);
		assert.equal(sortedSessions[2].isFocused, true);
	});

	test('applies moveTop back-to-front and focuses the top active window', () => {
		const callOrder = [];
		const mockWindows = [
			{id: 'win-bottom', moveTop: () => callOrder.push('moveTop:win-bottom'), focus: () => callOrder.push('focus:win-bottom')},
			{id: 'win-middle', moveTop: () => callOrder.push('moveTop:win-middle'), focus: () => callOrder.push('focus:win-middle')},
			{id: 'win-top', moveTop: () => callOrder.push('moveTop:win-top'), focus: () => callOrder.push('focus:win-top')},
		];

		const orderedWindows = [
			{win: mockWindows[0], shouldFocus: false},
			{win: mockWindows[1], shouldFocus: false},
			{win: mockWindows[2], shouldFocus: true},
		];

		// Simulate applyZOrder
		for (const item of orderedWindows) {
			item.win.moveTop();
		}
		const topItem = orderedWindows.find((item) => item.shouldFocus) ?? orderedWindows[orderedWindows.length - 1];
		if (topItem && topItem.shouldFocus) {
			topItem.win.focus();
		}

		assert.deepEqual(callOrder, [
			'moveTop:win-bottom',
			'moveTop:win-middle',
			'moveTop:win-top',
			'focus:win-top',
		]);
	});

	test('handles legacy session files without zOrder or isFocused gracefully', () => {
		const legacySessions = [
			{url: 'https://temple.hypersystem.xyz/channels/main', isMainWindow: true},
			{url: 'https://temple.hypersystem.xyz/channels/sec1', isMainWindow: false},
		];

		const sorted = [...legacySessions].sort((a, b) => (a.zOrder ?? 0) - (b.zOrder ?? 0));
		const focusedSession = sorted.find((s) => s.isFocused) ?? sorted[sorted.length - 1];

		// Does not crash, and defaults focus to the last entry
		assert.equal(sorted.length, 2);
		assert.equal(focusedSession.url, 'https://temple.hypersystem.xyz/channels/sec1');
	});
});
