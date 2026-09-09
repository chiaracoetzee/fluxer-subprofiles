// SPDX-License-Identifier: AGPL-3.0-or-later

import {SettingsSection} from '@app/features/app/components/dialogs/shared/SettingsSection';
import {SettingsTabContainer, SettingsTabContent} from '@app/features/app/components/dialogs/shared/SettingsTabLayout';
import {Endpoints} from '@app/features/app/constants/Endpoints';
import {http} from '@app/features/platform/transport/RestTransport';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {Avatar} from '@app/features/ui/components/Avatar';
import {type SegmentedTab, SegmentedTabs} from '@app/features/ui/segmented_tabs/SegmentedTabs';
import {AvatarUploader} from '@app/features/user/components/modals/tabs/my_profile_tab/AvatarUploader';
import Users from '@app/features/user/state/Users';
import type {Persona} from '@fluxer/schema/src/gen/fluxer/user/preferences/v1/preferences_pb';
import {Info, LockSimple, LockSimpleOpen, PencilSimple, Plus, Trash, UploadSimple} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useState} from 'react';
import {type AutoproxyMode, SubprofileStore} from '../../state/SubprofileStore';
import {openPluralKitImportModal} from '../modals/PluralKitImportModal';
import styles from './SubprofileSettingsTab.module.css';
import { Button } from '@app/features/ui/button/Button';

const AUTOPROXY_TABS: Array<SegmentedTab<AutoproxyMode>> = [
	{id: 'off', label: 'Off'},
	{id: 'manual', label: 'Manual'},
	{id: 'last', label: 'Last Used'},
];

const AUTOPROXY_DESCRIPTIONS: Record<AutoproxyMode, string> = {
	off: 'Untagged messages always send from your root account. Subprofiles only speak when you type their proxy tags (e.g. [text]).',
	manual:
		'Untagged messages send as your chosen subprofile. Typing another subprofile’s proxy tags will only send that single message and won’t switch who is active.',
	last: 'Untagged messages send as the subprofile that spoke most recently. Whenever anyone uses a proxy tag, they automatically become the active subprofile.',
};

interface PersonaFormState {
	id?: string;
	name: string;
	systemName: string;
	pronouns: string;
	avatarUrl: string;
	color: string;
	bio: string;
	proxyTags: Array<{prefix: string; suffix: string}>;
}

const emptyFormState = (): PersonaFormState => ({
	name: '',
	systemName: '',
	pronouns: '',
	avatarUrl: '',
	color: '',
	bio: '',
	proxyTags: [{prefix: '', suffix: ''}],
});

export const SubprofileSettingsTab: React.FC = observer(() => {
	const currentUser = Users.getCurrentUser();
	const personas = SubprofileStore.personas;
	const activePersonaId = SubprofileStore.activePersonaId;
	const isLatched = SubprofileStore.autoproxyLatched;

	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState<PersonaFormState>(emptyFormState());
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

	const handleAvatarUpload = async (base64: string) => {
		setFormData((prev) => ({...prev, avatarUrl: base64}));
		setIsUploadingAvatar(true);
		try {
			const res = await http.post<{avatar_url: string}>(Endpoints.USER_SUBPROFILE_AVATAR, {
				body: {avatar: base64},
			});
			if (res.ok && res.body?.avatar_url) {
				setFormData((prev) => ({...prev, avatarUrl: res.body.avatar_url}));
			} else {
				ToastCommands.createToast({
					type: 'error',
					children: 'Failed to upload avatar image to server',
				});
			}
		} catch {
			ToastCommands.createToast({
				type: 'error',
				children: 'Failed to upload avatar image to server',
			});
		} finally {
			setIsUploadingAvatar(false);
		}
	};

	const handleAvatarClear = () => {
		setFormData((prev) => ({...prev, avatarUrl: ''}));
	};

	const handleStartAdd = () => {
		setFormData(emptyFormState());
		setIsEditing(true);
	};

	const handleStartEdit = (persona: Persona) => {
		setFormData({
			id: persona.id,
			name: persona.name,
			systemName: persona.systemName ?? '',
			pronouns: persona.pronouns ?? '',
			avatarUrl: persona.avatarUrl ?? '',
			color: persona.color != null ? `#${persona.color.toString(16).padStart(6, '0')}` : '',
			bio: persona.bio ?? '',
			proxyTags:
				(persona.proxyTags ?? []).length > 0
					? (persona.proxyTags ?? []).map((t) => ({prefix: t.prefix ?? '', suffix: t.suffix ?? ''}))
					: [{prefix: '', suffix: ''}],
		});
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		setFormData(emptyFormState());
	};

	const handleSaveForm = async () => {
		if (isUploadingAvatar) {
			ToastCommands.createToast({
				type: 'info',
				children: 'Please wait for avatar image to finish uploading',
			});
			return;
		}

		const trimmedName = formData.name.trim();
		if (!trimmedName) return;

		let parsedColor: number | null = null;
		if (formData.color.trim()) {
			const cleanHex = formData.color.replace('#', '').trim();
			const parsed = Number.parseInt(cleanHex, 16);
			if (!Number.isNaN(parsed)) {
				parsedColor = parsed;
			}
		}

		const validTags = formData.proxyTags
			.map((t) => ({prefix: t.prefix.trim() || undefined, suffix: t.suffix.trim() || undefined}))
			.filter((t) => t.prefix || t.suffix);

		if (formData.id) {
			await SubprofileStore.updatePersona(formData.id, {
				name: trimmedName,
				systemName: formData.systemName.trim() || undefined,
				pronouns: formData.pronouns.trim() || undefined,
				avatarUrl: formData.avatarUrl.trim() || undefined,
				color: parsedColor ?? undefined,
				bio: formData.bio.trim() || undefined,
				proxyTags: validTags.map((t) => ({
					$typeName: 'fluxer.user.preferences.v1.ProxyTag',
					prefix: t.prefix,
					suffix: t.suffix,
				})),
			});
		} else {
			await SubprofileStore.addPersona({
				name: trimmedName,
				system_name: formData.systemName.trim() || null,
				pronouns: formData.pronouns.trim() || null,
				avatar_url: formData.avatarUrl.trim() || null,
				color: parsedColor,
				bio: formData.bio.trim() || null,
				proxy_tags: validTags,
			});
		}

		setIsEditing(false);
		setFormData(emptyFormState());
	};

	const handleDeletePersona = async (id: string) => {
		if (confirm('Are you sure you want to delete this persona?')) {
			await SubprofileStore.deletePersona(id);
		}
	};

	const autoproxyMode = SubprofileStore.autoproxyMode;

	const handleModeChange = async (mode: AutoproxyMode) => {
		await SubprofileStore.setAutoproxyMode(mode);
	};

	const handleToggleActive = async (personaId: string) => {
		if (activePersonaId === personaId && isLatched) {
			await SubprofileStore.unlatch();
		} else {
			await SubprofileStore.setActivePersona(personaId, true);
		}
	};

	const handleAddTagRow = () => {
		setFormData((prev) => ({
			...prev,
			proxyTags: [...prev.proxyTags, {prefix: '', suffix: ''}],
		}));
	};

	const handleRemoveTagRow = (index: number) => {
		setFormData((prev) => ({
			...prev,
			proxyTags: prev.proxyTags.filter((_, i) => i !== index),
		}));
	};

	const handleTagChange = (index: number, field: 'prefix' | 'suffix', value: string) => {
		setFormData((prev) => {
			const updated = [...prev.proxyTags];
			updated[index] = {...updated[index], [field]: value};
			return {...prev, proxyTags: updated};
		});
	};

	return (
		<SettingsTabContainer data-flx="user.subprofiles-settings-tab.container">
			<SettingsTabContent data-flx="user.subprofiles-settings-tab.content">
				<div className={styles.container}>
					{/* Header section */}
					<SettingsSection
						id="subprofiles_general"
						title="Subprofiles & Personas"
						description="Configure native subprofiles and personas for plural systems or multiple identities. Messages sent with your proxy tags or while latched will display under the chosen persona while keeping your account verifiable for safety."
						linkable={false}
					>
						<div className={styles.sectionHeader}>
							<div>
								<h4 className={styles.sectionTitle}>Autoproxy Mode</h4>
								<p className={styles.sectionDescription}>
									Choose how untagged messages and proxy prefixes interact with your active subprofile.
								</p>
							</div>
						</div>
						<div className={styles.modeControlWrapper}>
							<SegmentedTabs<AutoproxyMode>
								tabs={AUTOPROXY_TABS}
								selectedTab={autoproxyMode}
								onTabChange={(mode) => {
									void handleModeChange(mode);
								}}
								ariaLabel="Autoproxy mode"
							/>
							<div className={styles.modeHelperText}>
								<Info size={16} weight="bold" className={styles.modeHelperIcon} />
								<span>{AUTOPROXY_DESCRIPTIONS[autoproxyMode]}</span>
							</div>
						</div>
					</SettingsSection>

					{/* Editor Form */}
					{isEditing && (
						<div className={styles.editorCard}>
							<div className={styles.editorTitle}>{formData.id ? 'Edit Subprofile' : 'New Subprofile'}</div>
							<div className={styles.formGrid}>
								<div className={styles.formField}>
									<div className={styles.formLabel}>Name *</div>
									<input
										type="text"
										className={styles.textInput}
										placeholder="e.g. Alice"
										maxLength={100}
										value={formData.name}
										onChange={(e) => setFormData({...formData, name: e.target.value})}
									/>
								</div>
								<div className={styles.formField}>
									<div className={styles.formLabel}>System Tag</div>
									<input
										type="text"
										className={styles.textInput}
										placeholder="e.g. Wonderland System"
										maxLength={100}
										value={formData.systemName}
										onChange={(e) => setFormData({...formData, systemName: e.target.value})}
									/>
								</div>
								<div className={styles.formField}>
									<div className={styles.formLabel}>Pronouns</div>
									<input
										type="text"
										className={styles.textInput}
										placeholder="e.g. she/her"
										maxLength={100}
										value={formData.pronouns}
										onChange={(e) => setFormData({...formData, pronouns: e.target.value})}
									/>
								</div>
								<div className={styles.formField}>
									<div className={styles.formLabel}>Color (Hex)</div>
									<div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
										<input
											type="text"
											className={styles.textInput}
											placeholder="#4641D9"
											maxLength={7}
											value={formData.color}
											onChange={(e) => setFormData({...formData, color: e.target.value})}
											style={{flex: 1}}
										/>
										{formData.color && (
											<div className={styles.colorPreview} style={{backgroundColor: formData.color}} />
										)}
									</div>
								</div>
								<div className={styles.formField} style={{gridColumn: '1 / -1'}}>
									<div className={styles.formLabel}>Avatar</div>
									<div style={{display: 'flex', gap: 16, alignItems: 'center'}}>
										{currentUser && <Avatar user={currentUser} avatarUrl={formData.avatarUrl || undefined} size={64} />}
										<div style={{flex: 1}}>
											<AvatarUploader
												hasAvatar={Boolean(formData.avatarUrl)}
												onAvatarChange={handleAvatarUpload}
												onAvatarClear={handleAvatarClear}
												isPerGuildProfile={false}
												disabled={isUploadingAvatar}
											/>
										</div>
									</div>
								</div>
								<div className={styles.formField} style={{gridColumn: '1 / -1'}}>
									<div className={styles.formLabel}>Bio</div>
									<input
										type="text"
										className={styles.textInput}
										placeholder="Short description..."
										maxLength={2048}
										value={formData.bio}
										onChange={(e) => setFormData({...formData, bio: e.target.value})}
									/>
								</div>
								<div className={styles.formField} style={{gridColumn: '1 / -1'}}>
									<div
										style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}
									>
										<div className={styles.formLabel}>Proxy Tags (Prefix & Suffix)</div>
										<Button variant="secondary" small leftIcon={<Plus size={14} />} onClick={handleAddTagRow}>
											Add Tag Pair
										</Button>
									</div>
									{formData.proxyTags.map((tag, idx) => (
										<div key={idx} className={styles.tagRow}>
											<input
												type="text"
												className={styles.tagInput}
												placeholder="Prefix (e.g. [)"
												value={tag.prefix}
												onChange={(e) => handleTagChange(idx, 'prefix', e.target.value)}
											/>
											<span style={{color: 'var(--text-primary-muted)'}}>text</span>
											<input
												type="text"
												className={styles.tagInput}
												placeholder="Suffix (e.g. ])"
												value={tag.suffix}
												onChange={(e) => handleTagChange(idx, 'suffix', e.target.value)}
											/>
											{formData.proxyTags.length > 1 && (
												<Button
													variant="danger"
													small
													square
													icon={<Trash size={14} />}
													onClick={() => handleRemoveTagRow(idx)}
													aria-label="Remove tag pair"
												/>
											)}
										</div>
									))}
								</div>
							</div>
							<div className={styles.editorActions}>
								<Button variant="secondary" onClick={handleCancelEdit}>
									Cancel
								</Button>
								<Button
									variant="primary"
									disabled={!formData.name.trim() || isUploadingAvatar}
									onClick={handleSaveForm}
								>
									{isUploadingAvatar ? 'Uploading avatar...' : 'Save Subprofile'}
								</Button>
							</div>
						</div>
					)}

					{/* Personas List */}
					<SettingsSection
						id="subprofiles_list"
						title={`Configured Personas (${personas.length})`}
						linkable={false}
						actions={
							!isEditing && (
								<div style={{display: 'flex', gap: 8}}>
									<Button variant="secondary" onClick={openPluralKitImportModal}>
										<UploadSimple size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}} />
										Import from PluralKit
									</Button>
									<Button variant="primary" onClick={handleStartAdd}>
										<Plus size={16} style={{marginRight: 6, verticalAlign: 'text-bottom'}} />
										Add Subprofile
									</Button>
								</div>
							)
						}
					>
						{personas.length === 0 && !isEditing ? (
							<div className={styles.emptyState}>
								No subprofiles created yet. Click "Add Subprofile" to create your first persona!
							</div>
						) : (
							<div className={styles.cardList}>
								{personas.map((persona) => {
									const isThisActive = activePersonaId === persona.id && isLatched;
									return (
										<div key={persona.id} className={clsx(styles.personaCard, isThisActive && styles.activeCard)}>
											{currentUser && <Avatar user={currentUser} avatarUrl={persona.avatarUrl} size={40} />}
											<div className={styles.cardDetails}>
												<div className={styles.cardPrimaryRow}>
													<span className={styles.cardName}>{persona.name}</span>
													{persona.systemName && <span className={styles.cardSystemTag}>[{persona.systemName}]</span>}
													{persona.pronouns && <span className={styles.cardPronouns}>({persona.pronouns})</span>}
													{persona.color != null && (
														<div
															className={styles.colorPreview}
															style={{
																width: 14,
																height: 14,
																backgroundColor: `#${persona.color.toString(16).padStart(6, '0')}`,
															}}
														/>
													)}
												</div>
												<div className={styles.cardSecondaryRow}>
													{(persona.proxyTags ?? []).map((t, idx) => (
														<span key={idx} className={styles.tagPill}>
															{t.prefix ?? ''}text{t.suffix ?? ''}
														</span>
													))}
													{persona.bio && <span className={styles.cardBio}>{persona.bio}</span>}
												</div>
											</div>
											<div className={styles.cardActions}>
												<Button
													variant="secondary"
													onClick={() => handleToggleActive(persona.id)}
													aria-label={isThisActive ? 'Unlatch active persona' : 'Latch this persona'}
												>
													{isThisActive ? (
														<>
															<LockSimple size={14} color="var(--brand-primary)" /> Latched
														</>
													) : (
														<>
															<LockSimpleOpen size={14} /> Latch
														</>
													)}
												</Button>
												<Button
													variant="secondary"
													onClick={() => handleStartEdit(persona)}
													aria-label="Edit persona"
												>
													<PencilSimple size={14} /> Edit
												</Button>
												<Button
													variant="danger"
													onClick={() => handleDeletePersona(persona.id)}
													aria-label="Delete persona"
												>
													<Trash size={14} /> Delete
												</Button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</SettingsSection>
				</div>
			</SettingsTabContent>
		</SettingsTabContainer>
	);
});
export default SubprofileSettingsTab;
