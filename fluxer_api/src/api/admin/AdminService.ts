// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import type {IAdminRepository} from '@app/api/admin/IAdminRepository';
import {AdminApplicationService} from '@app/api/admin/services/AdminApplicationService';
import {AdminAssetPurgeService} from '@app/api/admin/services/AdminAssetPurgeService';
import {AdminAuditService} from '@app/api/admin/services/AdminAuditService';
import {AdminBanManagementService} from '@app/api/admin/services/AdminBanManagementService';
import {AdminCodeGenerationService} from '@app/api/admin/services/AdminCodeGenerationService';
import {AdminGuildService} from '@app/api/admin/services/AdminGuildService';
import {AdminMessageDeletionService} from '@app/api/admin/services/AdminMessageDeletionService';
import {AdminMessageService} from '@app/api/admin/services/AdminMessageService';
import {AdminMessageShredService} from '@app/api/admin/services/AdminMessageShredService';
import {AdminReportService} from '@app/api/admin/services/AdminReportService';
import {AdminSearchService} from '@app/api/admin/services/AdminSearchService';
import {AdminUserRelationshipService} from '@app/api/admin/services/AdminUserRelationshipService';
import {AdminUserService} from '@app/api/admin/services/AdminUserService';
import {AdminVoiceService} from '@app/api/admin/services/AdminVoiceService';
import type {UserID} from '@app/api/BrandedTypes';
import type {IChannelRepository} from '@app/api/channel/IChannelRepository';
import type {ChannelService} from '@app/api/channel/services/ChannelService';
import type {IGuildRepositoryAggregate} from '@app/api/guild/repositories/IGuildRepositoryAggregate';
import type {GuildService} from '@app/api/guild/services/GuildService';
import type {IDiscriminatorService} from '@app/api/infrastructure/DiscriminatorService';
import type {EntityAssetService} from '@app/api/infrastructure/EntityAssetService';
import type {IAssetDeletionQueue} from '@app/api/infrastructure/IAssetDeletionQueue';
import type {IStorageService} from '@app/api/infrastructure/IStorageService';
import type {KVBulkMessageDeletionQueueService} from '@app/api/infrastructure/KVBulkMessageDeletionQueueService';
import type {UserCacheService} from '@app/api/infrastructure/UserCacheService';
import type {InviteRepository} from '@app/api/invite/InviteRepository';
import type {IJobLedgerRepository} from '@app/api/jobs/IJobLedgerRepository';
import {JobAdminService} from '@app/api/jobs/JobAdminService';
import {
	getGuildDiscoveryRepository,
	getKVAccountDeletionQueue,
	getNcmecSubmissionService,
} from '@app/api/middleware/ServiceSingletons';
import type {IApplicationRepository} from '@app/api/oauth/repositories/IApplicationRepository';
import type {ReportService} from '@app/api/report/ReportService';
import type {IRiskHistoryRepository} from '@app/api/risk/HistoricalOutcomeRepository';
import type {ISuspiciousIpRepository} from '@app/api/risk/SuspiciousIpRepository';
import type {UserService} from '@app/api/user/services/UserService';
import type {VoiceRepository} from '@app/api/voice/VoiceRepository';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import {BadRequestError} from '@fluxer/errors/src/domains/core/BadRequestError';
import type {SendSystemDmResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {IpInfoService} from '@pkgs/geoip/src/IpInfoService';
import type Stripe from 'stripe';

export const MAX_SYSTEM_DM_ALL_USERS_LIMIT = 1000;

export class AdminService {
	readonly auditService: AdminAuditService;
	readonly banManagementService: AdminBanManagementService;
	readonly userService: AdminUserService;
	readonly guildServiceAggregate: AdminGuildService;
	readonly messageService: AdminMessageService;
	readonly messageShredService: AdminMessageShredService;
	readonly messageDeletionService: AdminMessageDeletionService;
	readonly reportServiceAggregate: AdminReportService;
	readonly voiceService: AdminVoiceService;
	readonly searchService: AdminSearchService;
	readonly codeGenerationService: AdminCodeGenerationService;
	readonly assetPurgeService: AdminAssetPurgeService;
	readonly applicationService: AdminApplicationService;
	readonly jobAdminService: JobAdminService;
	readonly relationshipService: AdminUserRelationshipService;

	constructor(
		private readonly apiContext: ApiContext,
		private readonly guildRepository: IGuildRepositoryAggregate,
		private readonly channelRepository: IChannelRepository,
		private readonly adminRepository: IAdminRepository,
		private readonly inviteRepository: InviteRepository,
		private readonly discriminatorService: IDiscriminatorService,
		private readonly guildService: GuildService,
		private readonly userCacheService: UserCacheService,
		private readonly channelService: ChannelService,
		private readonly runtimeUserService: UserService,
		private readonly entityAssetService: EntityAssetService,
		private readonly assetDeletionQueue: IAssetDeletionQueue,
		private readonly storageService: IStorageService,
		private readonly reportService: ReportService,
		private readonly voiceRepository: VoiceRepository,
		private readonly bulkMessageDeletionQueue: KVBulkMessageDeletionQueueService,
		private readonly applicationRepository: IApplicationRepository,
		private readonly stripe: Stripe | null = null,
		private readonly riskHistoryRepository: Pick<IRiskHistoryRepository, 'recordOutcomeForUser'>,
		private readonly jobLedger: IJobLedgerRepository,
		private readonly ipInfoService: IpInfoService,
		private readonly suspiciousIpRepository: ISuspiciousIpRepository,
	) {
		const {users, gateway, worker, snowflake} = this.apiContext.services;
		this.auditService = new AdminAuditService(this.adminRepository, snowflake, {
			userRepository: users,
			guildRepository: this.guildRepository,
			channelRepository: this.channelRepository,
		});
		this.banManagementService = new AdminBanManagementService({
			apiContext: this.apiContext,
			adminRepository: this.adminRepository,
			auditService: this.auditService,
			ipInfoService: this.ipInfoService,
			suspiciousIpRepository: this.suspiciousIpRepository,
		});
		this.userService = new AdminUserService({
			apiContext: this.apiContext,
			guildRepository: this.guildRepository,
			channelRepository: this.channelRepository,
			discriminatorService: this.discriminatorService,
			entityAssetService: this.entityAssetService,
			auditService: this.auditService,
			userCacheService: this.userCacheService,
			banManagementService: this.banManagementService,
			kvDeletionQueue: getKVAccountDeletionQueue(),
			bulkMessageDeletionQueue: this.bulkMessageDeletionQueue,
			stripe: this.stripe,
			riskHistoryRepository: this.riskHistoryRepository,
			reportService: this.reportService,
		});
		this.guildServiceAggregate = new AdminGuildService({
			guildRepository: this.guildRepository,
			userRepository: users,
			channelRepository: this.channelRepository,
			inviteRepository: this.inviteRepository,
			guildService: this.guildService,
			gatewayService: gateway,
			entityAssetService: this.entityAssetService,
			auditService: this.auditService,
			discoveryRepository: getGuildDiscoveryRepository(),
		});
		this.assetPurgeService = new AdminAssetPurgeService({
			guildRepository: this.guildRepository,
			gatewayService: gateway,
			assetDeletionQueue: this.assetDeletionQueue,
			auditService: this.auditService,
		});
		this.messageService = new AdminMessageService({
			apiContext: this.apiContext,
			channelRepository: this.channelRepository,
			guildRepository: this.guildRepository,
			auditService: this.auditService,
			ncmecSubmissionService: getNcmecSubmissionService(),
		});
		this.messageShredService = new AdminMessageShredService({
			apiContext: this.apiContext,
			auditService: this.auditService,
		});
		this.messageDeletionService = new AdminMessageDeletionService({
			channelRepository: this.channelRepository,
			messageShredService: this.messageShredService,
			auditService: this.auditService,
		});
		this.reportServiceAggregate = new AdminReportService({
			apiContext: this.apiContext,
			reportService: this.reportService,
			guildRepository: this.guildRepository,
			channelRepository: this.channelRepository,
			channelService: this.channelService,
			storageService: this.storageService,
			auditService: this.auditService,
			userCacheService: this.userCacheService,
			userChannelService: this.runtimeUserService.channelService,
			ncmecSubmissionService: getNcmecSubmissionService(),
		});
		this.voiceService = new AdminVoiceService({
			apiContext: this.apiContext,
			voiceRepository: this.voiceRepository,
			auditService: this.auditService,
		});
		this.searchService = new AdminSearchService({
			apiContext: this.apiContext,
			guildRepository: this.guildRepository,
			auditService: this.auditService,
		});
		this.codeGenerationService = new AdminCodeGenerationService(users);
		this.applicationService = new AdminApplicationService({
			apiContext: this.apiContext,
			applicationRepository: this.applicationRepository,
			auditService: this.auditService,
			guildRepository: this.guildRepository,
		});
		this.jobAdminService = new JobAdminService(this.jobLedger, worker);
		this.relationshipService = new AdminUserRelationshipService({
			apiContext: this.apiContext,
			auditService: this.auditService,
		});
	}

	async sendSystemDm(
		data: {content: string; userIds?: Array<string>; allUsers?: boolean},
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<SendSystemDmResponse> {
		let userIds = data.userIds ?? [];
		if (data.allUsers) {
			const userRepository = this.apiContext.services.users;
			let pageState: string | null = null;
			userIds = [];
			do {
				const page = await userRepository.scanAllUsersPage(1000, pageState);
				pageState = page.pageState;
				for (const user of page.users) {
					// Exclude system account, bots, and deleted/self-deleted accounts
					if (user.id === 0n || user.isSystem || user.isBot) {
						continue;
					}
					if (
						(user.flags & UserFlags.DELETED) !== 0n ||
						(user.flags & UserFlags.SELF_DELETED) !== 0n ||
						user.pendingDeletionAt !== null
					) {
						continue;
					}
					userIds.push(user.id.toString());
				}
				if (userIds.length > MAX_SYSTEM_DM_ALL_USERS_LIMIT) {
					throw new BadRequestError({
						code: APIErrorCodes.INVALID_FORM_BODY,
						message: `Broadcast to all users is limited to instances with at most ${MAX_SYSTEM_DM_ALL_USERS_LIMIT} active users (found ${userIds.length}). Please specify recipient user IDs directly.`,
					});
				}
			} while (pageState);
		}

		if (userIds.length === 0) {
			return {recipient_count: 0};
		}

		await this.apiContext.services.worker.addJob(
			'sendSystemDm',
			{
				content: data.content,
				user_ids: userIds,
			},
			{requireLedger: true},
		);
		const metadata = new Map<string, string>([
			['recipient_count', userIds.length.toString()],
			['content_length', data.content.length.toString()],
		]);
		if (data.allUsers) {
			metadata.set('all_users', 'true');
		}
		await this.auditService.createAuditLog({
			adminUserId,
			targetType: 'system_dm',
			targetId: 0n,
			action: 'system_dm.send',
			auditLogReason,
			metadata,
		});
		return {recipient_count: userIds.length};
	}
}
