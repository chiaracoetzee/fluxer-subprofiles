// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import type {AuthenticatedChannel} from '@app/api/channel/services/AuthenticatedChannel';
import {dispatchChannelEvent} from '@app/api/channel/services/ChannelGatewayDispatch';
import {MessageInteractionBase} from '@app/api/channel/services/interaction/MessageInteractionBase';
import type {Channel} from '@app/api/models/Channel';
import {GuildOperations} from '@fluxer/constants/src/GuildConstants';

// Fork imports.

import {resolveTypingSubprofile} from '@app/api/persona/TypingPersona';

export class MessageReadStateService extends MessageInteractionBase {
	async startTyping({
		authChannel,
		userId,
		personaId,
	}: {
		authChannel: AuthenticatedChannel;
		userId: UserID;
		personaId?: string | null;
	}): Promise<void> {
		const {channel, guild} = authChannel;
		this.ensureTextChannel(channel);
		if (this.isOperationDisabled(guild, GuildOperations.TYPING_EVENTS)) {
			return;
		}
		await this.dispatchTypingStart({channel, userId, personaId});
	}

	private async dispatchTypingStart({
		channel,
		userId,
		personaId,
	}: {
		channel: Channel;
		userId: UserID;
		personaId?: string | null;
	}): Promise<void> {
		// Fork: the indicator shows the persona as the server knows it, never what the request said about it.
		const subprofile = await resolveTypingSubprofile(userId, personaId);
		await dispatchChannelEvent({
			gatewayService: this.gatewayService,
			channel,
			event: 'TYPING_START',
			data: {
				channel_id: channel.id.toString(),
				user_id: userId.toString(),
				timestamp: Math.floor(Date.now() / 1000),
				subprofile,
			},
		});
	}
}
