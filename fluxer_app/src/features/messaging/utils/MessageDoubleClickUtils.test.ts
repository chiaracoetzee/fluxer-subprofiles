// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import {
	isInteractiveDoubleClickTarget,
	shouldTriggerDoubleClickEdit,
} from '@app/features/messaging/utils/MessageDoubleClickUtils';
import type {Message} from '@app/features/messaging/models/MessagingMessage';
import {MessageStates} from '@fluxer/constants/src/ChannelConstants';
import {describe, expect, it} from 'vitest';

function createMockMessage(overrides: Partial<Message> = {}): Message {
	return {
		id: 'msg-1',
		channelId: 'chan-1',
		content: 'Hello world',
		state: MessageStates.SENT,
		isUserMessage: () => true,
		messageSnapshots: undefined,
		...overrides,
	} as unknown as Message;
}

describe('MessageDoubleClickUtils', () => {
	describe('isInteractiveDoubleClickTarget', () => {
		it('returns false for null or non-elements', () => {
			expect(isInteractiveDoubleClickTarget(null)).toBe(false);
		});

		it('returns false for regular text / container elements', () => {
			const div = document.createElement('div');
			const span = document.createElement('span');
			div.appendChild(span);
			expect(isInteractiveDoubleClickTarget(span)).toBe(false);
			expect(isInteractiveDoubleClickTarget(div)).toBe(false);
		});

		it('returns true for links and elements inside links', () => {
			const link = document.createElement('a');
			const linkText = document.createElement('span');
			link.appendChild(linkText);
			expect(isInteractiveDoubleClickTarget(link)).toBe(true);
			expect(isInteractiveDoubleClickTarget(linkText)).toBe(true);
		});

		it('returns true for buttons and elements inside buttons', () => {
			const button = document.createElement('button');
			const icon = document.createElement('span');
			button.appendChild(icon);
			expect(isInteractiveDoubleClickTarget(button)).toBe(true);
			expect(isInteractiveDoubleClickTarget(icon)).toBe(true);

			const roleButton = document.createElement('div');
			roleButton.setAttribute('role', 'button');
			expect(isInteractiveDoubleClickTarget(roleButton)).toBe(true);
		});

		it('returns true for inputs, textareas, audio, video', () => {
			expect(isInteractiveDoubleClickTarget(document.createElement('input'))).toBe(true);
			expect(isInteractiveDoubleClickTarget(document.createElement('textarea'))).toBe(true);
			expect(isInteractiveDoubleClickTarget(document.createElement('video'))).toBe(true);
			expect(isInteractiveDoubleClickTarget(document.createElement('audio'))).toBe(true);
		});

		it('returns true for popout, avatar, username, embed, attachment targets', () => {
			const avatar = document.createElement('div');
			avatar.setAttribute('data-flx', 'channel.message-avatar.avatar');
			expect(isInteractiveDoubleClickTarget(avatar)).toBe(true);

			const attachment = document.createElement('div');
			attachment.setAttribute('data-flx', 'channel.message-attachment.mosaic');
			expect(isInteractiveDoubleClickTarget(attachment)).toBe(true);

			const actionBar = document.createElement('div');
			actionBar.setAttribute('data-flx', 'channel.message-action-bar');
			expect(isInteractiveDoubleClickTarget(actionBar)).toBe(true);
		});
	});

	describe('shouldTriggerDoubleClickEdit', () => {
		it('returns false when doubleClickToEdit is disabled', () => {
			const msg = createMockMessage();
			expect(
				shouldTriggerDoubleClickEdit({
					doubleClickToEditEnabled: false,
					target: document.createElement('span'),
					message: msg,
					isEditing: false,
					canEditMessage: true,
				}),
			).toBe(false);
		});

		it('returns false when already editing', () => {
			const msg = createMockMessage();
			expect(
				shouldTriggerDoubleClickEdit({
					doubleClickToEditEnabled: true,
					target: document.createElement('span'),
					message: msg,
					isEditing: true,
					canEditMessage: true,
				}),
			).toBe(false);
		});

		it('returns false in preview context', () => {
			const msg = createMockMessage();
			expect(
				shouldTriggerDoubleClickEdit({
					doubleClickToEditEnabled: true,
					target: document.createElement('span'),
					message: msg,
					isEditing: false,
					previewContext: 1 as any,
					canEditMessage: true,
				}),
			).toBe(false);
		});

		it('returns false when message is in sending state', () => {
			const msg = createMockMessage({state: MessageStates.SENDING});
			expect(
				shouldTriggerDoubleClickEdit({
					doubleClickToEditEnabled: true,
					target: document.createElement('span'),
					message: msg,
					isEditing: false,
					canEditMessage: true,
				}),
			).toBe(false);
		});

		it('returns false when message is not a user message', () => {
			const msg = createMockMessage({isUserMessage: () => false});
			expect(
				shouldTriggerDoubleClickEdit({
					doubleClickToEditEnabled: true,
					target: document.createElement('span'),
					message: msg,
					isEditing: false,
					canEditMessage: true,
				}),
			).toBe(false);
		});

		it('returns false when message has messageSnapshots', () => {
			const msg = createMockMessage({messageSnapshots: [{}] as any});
			expect(
				shouldTriggerDoubleClickEdit({
					doubleClickToEditEnabled: true,
					target: document.createElement('span'),
					message: msg,
					isEditing: false,
					canEditMessage: true,
				}),
			).toBe(false);
		});

		it('returns false when target is interactive', () => {
			const link = document.createElement('a');
			const msg = createMockMessage();
			expect(
				shouldTriggerDoubleClickEdit({
					doubleClickToEditEnabled: true,
					target: link,
					message: msg,
					isEditing: false,
					canEditMessage: true,
				}),
			).toBe(false);
		});

		it('returns false when user cannot edit message', () => {
			const msg = createMockMessage();
			expect(
				shouldTriggerDoubleClickEdit({
					doubleClickToEditEnabled: true,
					target: document.createElement('span'),
					message: msg,
					isEditing: false,
					canEditMessage: false,
				}),
			).toBe(false);
		});

		it('returns true when all conditions are satisfied', () => {
			const span = document.createElement('span');
			const msg = createMockMessage();
			expect(
				shouldTriggerDoubleClickEdit({
					doubleClickToEditEnabled: true,
					target: span,
					message: msg,
					isEditing: false,
					canEditMessage: true,
				}),
			).toBe(true);
		});
	});
});
