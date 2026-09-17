// SPDX-License-Identifier: AGPL-3.0-or-later

import {decideComposerTyping} from '@app/features/typing/rolling/RollingComposerTypingGate';
import RollingTypingSender from '@app/features/typing/rolling/RollingTypingSender';

import type {MessageSubprofileRequest} from '@fluxer/schema/src/domains/persona/PersonaSchemas';

interface ComposerTypingInput {
	channelId: string;
	value: string;
	previousValue: string | null;
	enabled: boolean;
	typingEnabled: boolean;
	isEditingMessageInComposer: boolean;
	subprofile?: MessageSubprofileRequest | null;
}

class TypingManager {
	handleComposerChange(input: ComposerTypingInput): void {
		const decision = decideComposerTyping({
			previousValue: input.previousValue,
			value: input.value,
			isEditingMessageInComposer: input.isEditingMessageInComposer,
			enabled: input.enabled && input.typingEnabled,
		});
		if (decision === 'start') {
			RollingTypingSender.startTyping(input.channelId, input.subprofile);
		} else if (decision === 'stop') {
			RollingTypingSender.stopTyping(input.channelId);
		}
	}

	clear(channelId: string): void {
		RollingTypingSender.stopTyping(channelId);
	}

	handleOwnMessageSent(channelId: string): void {
		RollingTypingSender.handleOwnMessageSent(channelId);
	}
}

export const TypingUtils = new TypingManager();
