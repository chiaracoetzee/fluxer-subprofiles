// SPDX-License-Identifier: AGPL-3.0-or-later

import {isAvatarMediaHash} from '@app/features/persona/utils/AvatarSource';
import {describe, expect, it} from 'vitest';

describe('isAvatarMediaHash', () => {
	it('accepts media hashes, animated ones included', () => {
		expect(isAvatarMediaHash('a9b53c9e4f1d2e3a')).toBe(true);
		expect(isAvatarMediaHash('a_a9b53c9e4f1d2e3a')).toBe(true);
	});

	it('rejects relative addresses such as the bundled default avatars', () => {
		expect(isAvatarMediaHash('/assets/51293f1b86757263.png')).toBe(false);
		expect(isAvatarMediaHash('assets/51293f1b86757263.png')).toBe(false);
	});

	it('rejects absolute, data and blob addresses', () => {
		expect(isAvatarMediaHash('https://temple.hypersystem.xyz/assets/x.png')).toBe(false);
		expect(isAvatarMediaHash('data:image/png;base64,AAAA')).toBe(false);
		expect(isAvatarMediaHash('blob:https://temple.hypersystem.xyz/0f1e')).toBe(false);
	});
});
