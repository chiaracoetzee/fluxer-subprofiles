// SPDX-License-Identifier: AGPL-3.0-or-later

import type {MessagePreviewContext} from '@app/features/channel/models/MessagePreviewContext';
import type {Message} from '@app/features/messaging/models/MessagingMessage';
import {MessageStates} from '@fluxer/constants/src/ChannelConstants';

const INTERACTIVE_TARGET_SELECTOR = [
	'a',
	'button',
	'[role="button"]',
	'input',
	'textarea',
	'select',
	'video',
	'audio',
	'[data-interactive="true"]',
	'[data-popout-target]',
	'[data-preloadable-user]',
	'[data-flx*="attachment"]',
	'[data-flx*="embed"]',
	'[data-flx*="action-bar"]',
	'[data-flx*="popout"]',
	'[data-flx*="avatar"]',
	'[data-flx*="username"]',
].join(', ');

export interface DoubleClickEditCheckParams {
	doubleClickToEditEnabled: boolean;
	target: EventTarget | null;
	message: Message;
	isEditing: boolean;
	previewContext?: MessagePreviewContext | null;
	canEditMessage: boolean;
}

export function isInteractiveDoubleClickTarget(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) {
		return false;
	}
	return target.closest(INTERACTIVE_TARGET_SELECTOR) != null;
}

export function shouldTriggerDoubleClickEdit(params: DoubleClickEditCheckParams): boolean {
	if (!params.doubleClickToEditEnabled) {
		return false;
	}
	if (params.previewContext != null || params.isEditing) {
		return false;
	}
	if (params.message.state === MessageStates.SENDING) {
		return false;
	}
	if (params.message.messageSnapshots != null || !params.message.isUserMessage()) {
		return false;
	}
	if (isInteractiveDoubleClickTarget(params.target)) {
		return false;
	}
	return params.canEditMessage;
}
