// SPDX-License-Identifier: AGPL-3.0-or-later

import {shouldAnimateMessageEmojiByDefault} from '@app/features/channel/components/MessageEmojiAnimationUtils';
import {describe, expect, it} from 'vitest';

describe('shouldAnimateMessageEmojiByDefault', () => {
	it('returns false when animateEmojiSetting is false regardless of other flags', () => {
		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: false,
				windowFocused: true,
				windowVisible: true,
			}),
		).toBe(false);

		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: false,
				animatedMediaPlaybackAllowed: true,
			}),
		).toBe(false);
	});

	it('honors animatedMediaPlaybackAllowed override when provided', () => {
		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: true,
				animatedMediaPlaybackAllowed: false,
				windowFocused: true,
			}),
		).toBe(false);

		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: true,
				animatedMediaPlaybackAllowed: true,
				windowFocused: false,
			}),
		).toBe(true);
	});

	it('returns false when windowVisible is false', () => {
		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: true,
				windowVisible: false,
				windowFocused: true,
			}),
		).toBe(false);
	});

	it('returns true when window is focused and visible', () => {
		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: true,
				windowFocused: true,
				windowVisible: true,
			}),
		).toBe(true);
	});

	it('returns false when window is unfocused and stayInteractiveWhenUnfocused is false (default)', () => {
		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: true,
				windowFocused: false,
				stayInteractiveWhenUnfocused: false,
			}),
		).toBe(false);

		// With stayInteractiveWhenUnfocused omitted (default false)
		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: true,
				windowFocused: false,
			}),
		).toBe(false);
	});

	it('returns true when window is unfocused but stayInteractiveWhenUnfocused is true', () => {
		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: true,
				windowFocused: false,
				stayInteractiveWhenUnfocused: true,
			}),
		).toBe(true);
	});

	it('uses safe defaults for omitted windowVisible and windowFocused', () => {
		expect(
			shouldAnimateMessageEmojiByDefault({
				animateEmojiSetting: true,
			}),
		).toBe(true);
	});
});
