// SPDX-License-Identifier: AGPL-3.0-or-later

import {CallController} from '@app/api/channel/controllers/CallController';
import {ChannelController} from '@app/api/channel/controllers/ChannelController';
import {ChannelFollowController} from '@app/api/channel/controllers/ChannelFollowController';
import {ChannelPersonaMentionController} from '@app/api/channel/controllers/ChannelPersonaMentionController';
import {MessageController} from '@app/api/channel/controllers/MessageController';
import {MessageInteractionController} from '@app/api/channel/controllers/MessageInteractionController';
import {StreamController} from '@app/api/channel/controllers/StreamController';
import type {HonoApp} from '@app/api/types/HonoEnv';

export function registerChannelControllers(app: HonoApp) {
	ChannelController(app);
	ChannelFollowController(app);
	ChannelPersonaMentionController(app);
	MessageInteractionController(app);
	MessageController(app);
	CallController(app);
	StreamController(app);
}
