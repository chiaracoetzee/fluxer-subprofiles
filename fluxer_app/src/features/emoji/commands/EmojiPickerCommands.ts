// SPDX-License-Identifier: AGPL-3.0-or-later

import EmojiPicker, {getEmojiUsageKey} from '@app/features/emoji/state/EmojiPicker';
import type {FlatEmoji} from '@app/features/emoji/types/EmojiTypes';

type EmojiPickerIntent =
	| {kind: 'track'; emoji: FlatEmoji; personaId?: string | null}
	| {kind: 'favorite'; emoji: FlatEmoji}
	| {kind: 'pin'; emoji: FlatEmoji; personaId?: string | null}
	| {kind: 'category'; category: string};

function dispatchEmojiPickerIntent(intent: EmojiPickerIntent): void {
	switch (intent.kind) {
		case 'track':
			EmojiPicker.trackEmojiUsage(getEmojiUsageKey(intent.emoji), intent.personaId);
			return;
		case 'favorite':
			EmojiPicker.toggleFavorite(getEmojiUsageKey(intent.emoji));
			return;
		case 'pin':
			EmojiPicker.togglePin(getEmojiUsageKey(intent.emoji), intent.personaId);
			return;
		case 'category':
			EmojiPicker.toggleCategory(intent.category);
			return;
	}
}

export function trackEmojiUsage(emoji: FlatEmoji, personaId?: string | null): void {
	dispatchEmojiPickerIntent({kind: 'track', emoji, personaId});
}

export function toggleFavorite(emoji: FlatEmoji): void {
	dispatchEmojiPickerIntent({kind: 'favorite', emoji});
}

export function togglePinned(emoji: FlatEmoji, personaId?: string | null): void {
	dispatchEmojiPickerIntent({kind: 'pin', emoji, personaId});
}

export function toggleCategory(category: string): void {
	dispatchEmojiPickerIntent({kind: 'category', category});
}
