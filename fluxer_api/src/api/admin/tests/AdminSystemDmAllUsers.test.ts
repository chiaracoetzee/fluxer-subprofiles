// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, setUserACLs} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {createUserID} from '@app/api/BrandedTypes';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import {User} from '@app/api/models/User';
import {UserRepository} from '@app/api/user/repositories/UserRepository';
import {MAX_SYSTEM_DM_ALL_USERS_LIMIT} from '@app/api/admin/AdminService';
import {beforeEach, describe, expect, test, vi} from 'vitest';

interface SendSystemDmResponse {
	recipient_count: number;
}

describe('Admin System DM all_users broadcast', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('rejects request when all_users is false and user_ids is empty', async () => {
		const admin = await createTestAccount(harness);
		const updated = await setUserACLs(harness, admin, ['admin:authenticate', 'system_dm:send']);
		await createBuilder(harness, `${updated.token}`)
			.post('/admin/system-dms')
			.body({content: 'Hello World', user_ids: []})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('successfully queues system DM for all active users', async () => {
		const admin = await createTestAccount(harness);
		const updated = await setUserACLs(harness, admin, ['admin:authenticate', 'system_dm:send']);
		const recipient = await createTestAccount(harness);

		const response = await createBuilder<SendSystemDmResponse>(harness, `${updated.token}`)
			.post('/admin/system-dms')
			.body({content: 'Server announcement', all_users: true})
			.expect(HTTP_STATUS.OK)
			.execute();

		// Should include the active accounts created in this test harness
		expect(response.recipient_count).toBeGreaterThanOrEqual(1);
	});

	test('defense in depth: aborts if active user count exceeds safety limit', async () => {
		const admin = await createTestAccount(harness);
		const updated = await setUserACLs(harness, admin, ['admin:authenticate', 'system_dm:send']);

		// Mock scanAllUsersPage to simulate a large instance exceeding MAX_SYSTEM_DM_ALL_USERS_LIMIT
		const fakeUsers: Array<User> = Array.from({length: MAX_SYSTEM_DM_ALL_USERS_LIMIT + 5}, (_, i) => {
			return new User({
				user_id: createUserID(BigInt(100000 + i)),
				username: `user_${i}`,
				discriminator: 1,
				bot: false,
				system: false,
				flags: 0n,
			} as any);
		});

		vi.spyOn(UserRepository.prototype, 'scanAllUsersPage').mockResolvedValue({
			users: fakeUsers,
			pageState: null,
		});

		await createBuilder(harness, `${updated.token}`)
			.post('/admin/system-dms')
			.body({content: 'Broadcast announcement', all_users: true})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
