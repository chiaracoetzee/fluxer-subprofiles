// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import {describe, expect, it} from 'vitest';
import {
	isInteractiveDoubleClickTarget,
	shouldTriggerDoubleClickEdit,
	type DoubleClickEditCheckParams,
} from '@app/features/messaging/utils/MessageDoubleClickUtils';
import {MessagePreviewContext, MessageStates} from '@fluxer/constants/src/ChannelConstants';

describe('MessageDoubleClickUtils', () => {
	describe('isInteractiveDoubleClickTarget', () => {
		it('returns false for null or non-Element targets', () => {
			expect(isInteractiveDoubleClickTarget(null)).toBe(false);
			expect(isInteractiveDoubleClickTarget(undefined as any)).toBe(false);
			expect(isInteractiveDoubleClickTarget({} as any)).toBe(false);
		});

		it('returns false for non-interactive elements', () => {
			const div = document.createElement('div');
			const span = document.createElement('span');
			const p = document.createElement('p');
			div.appendChild(span);
			span.appendChild(p);

			expect(isInteractiveDoubleClickTarget(div)).toBe(false);
			expect(isInteractiveDoubleClickTarget(span)).toBe(false);
			expect(isInteractiveDoubleClickTarget(p)).toBe(false);
		});

		it('returns true for standard interactive HTML elements', () => {
			const button = document.createElement('button');
			const link = document.createElement('a');
			const input = document.createElement('input');
			const textarea = document.createElement('textarea');
			const select = document.createElement('select');
			const video = document.createElement('video');
			const audio = document.createElement('audio');

			expect(isInteractiveDoubleClickTarget(button)).toBe(true);
			expect(isInteractiveDoubleClickTarget(link)).toBe(true);
			expect(isInteractiveDoubleClickTarget(input)).toBe(true);
			expect(isInteractiveDoubleClickTarget(textarea)).toBe(true);
			expect(isInteractiveDoubleClickTarget(select)).toBe(true);
			expect(isInteractiveDoubleClickTarget(video)).toBe(true);
			expect(isInteractiveDoubleClickTarget(audio)).toBe(true);
		});

		it('returns true for elements with interactive roles or attributes', () => {
			const divRoleButton = document.createElement('div');
			divRoleButton.setAttribute('role', 'button');

			const divInteractive = document.createElement('div');
			divInteractive.setAttribute('data-interactive', 'true');

			const divPopout = document.createElement('div');
			divPopout.setAttribute('data-popout-target', 'true');

			const divPreload = document.createElement('div');
			divPreload.setAttribute('data-preloadable-user', 'true');

			expect(isInteractiveDoubleClickTarget(divRoleButton)).toBe(true);
			expect(isInteractiveDoubleClickTarget(divInteractive)).toBe(true);
			expect(isInteractiveDoubleClickTarget(divPopout)).toBe(true);
			expect(isInteractiveDoubleClickTarget(divPreload)).toBe(true);
		});

		it('returns true for Fluxer custom data attributes', () => {
			const avatar = document.createElement('div');
			avatar.setAttribute('data-flx', 'channel.message.avatar');

			const username = document.createElement('span');
			username.setAttribute('data-flx', 'channel.message.username');

			const actionBar = document.createElement('div');
			actionBar.setAttribute('data-flx', 'channel.message.action-bar');

			const embed = document.createElement('div');
			embed.setAttribute('data-flx', 'channel.message.embed');

			const attachment = document.createElement('div');
			attachment.setAttribute('data-flx', 'channel.message.attachment');

			expect(isInteractiveDoubleClickTarget(avatar)).toBe(true);
			expect(isInteractiveDoubleClickTarget(username)).toBe(true);
			expect(isInteractiveDoubleClickTarget(actionBar)).toBe(true);
			expect(isInteractiveDoubleClickTarget(embed)).toBe(true);
			expect(isInteractiveDoubleClickTarget(attachment)).toBe(true);
		});

		it('returns true when child of an interactive element is clicked', () => {
			const button = document.createElement('button');
			const span = document.createElement('span');
			const icon = document.createElement('i');
			button.appendChild(span);
			span.appendChild(icon);

			expect(isInteractiveDoubleClickTarget(icon)).toBe(true);
			expect(isInteractiveDoubleClickTarget(span)).toBe(true);
		});
	});

	describe('shouldTriggerDoubleClickEdit', () => {
		function createMockMessage(overrides: Partial<any> = {}) {
			return {
				state: MessageStates.SENT,
				messageSnapshots: null,
				isUserMessage: () => true,
				...overrides,
			} as any;
		}

		function createDefaultParams(overrides: Partial<DoubleClickEditCheckParams> = {}): DoubleClickEditCheckParams {
			const container = document.createElement('div');
			const textSpan = document.createElement('span');
			container.appendChild(textSpan);

			return {
				doubleClickToEditEnabled: true,
				target: textSpan,
				message: createMockMessage(),
				isEditing: false,
				previewContext: null,
				canEditMessage: true,
				...overrides,
			};
		}

		it('returns true when all conditions are met', () => {
			const params = createDefaultParams();
			expect(shouldTriggerDoubleClickEdit(params)).toBe(true);
		});

		it('returns false when doubleClickToEditEnabled is false', () => {
			const params = createDefaultParams({doubleClickToEditEnabled: false});
			expect(shouldTriggerDoubleClickEdit(params)).toBe(false);
		});

		it('returns false when already editing', () => {
			const params = createDefaultParams({isEditing: true});
			expect(shouldTriggerDoubleClickEdit(params)).toBe(false);
		});

		it('returns false when previewContext is present', () => {
			const params = createDefaultParams({
				previewContext: 'REPLY' as keyof typeof MessagePreviewContext,
			});
			expect(shouldTriggerDoubleClickEdit(params)).toBe(false);
		});

		it('returns false when message state is SENDING', () => {
			const params = createDefaultParams({
				message: createMockMessage({state: MessageStates.SENDING}),
			});
			expect(shouldTriggerDoubleClickEdit(params)).toBe(false);
		});

		it('returns false when message has messageSnapshots', () => {
			const params = createDefaultParams({
				message: createMockMessage({messageSnapshots: [{}]}),
			});
			expect(shouldTriggerDoubleClickEdit(params)).toBe(false);
		});

		it('returns false when message is not a user message', () => {
			const params = createDefaultParams({
				message: createMockMessage({isUserMessage: () => false}),
			});
			expect(shouldTriggerDoubleClickEdit(params)).toBe(false);
		});

		it('returns false when target is interactive', () => {
			const button = document.createElement('button');
			const params = createDefaultParams({target: button});
			expect(shouldTriggerDoubleClickEdit(params)).toBe(false);
		});

		it('returns false when canEditMessage is false', () => {
			const params = createDefaultParams({canEditMessage: false});
			expect(shouldTriggerDoubleClickEdit(params)).toBe(false);
		});
	});
});
