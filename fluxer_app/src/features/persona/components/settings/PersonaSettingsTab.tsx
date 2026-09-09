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
import {type ActivePersonaMode, PersonaStore} from '../../state/PersonaStore';
import {openPluralKitImportModal} from '../modals/PluralKitImportModal';
import styles from './PersonaSettingsTab.module.css';
import { Button } from '@app/features/ui/button/Button';
import {ColorPickerField} from '@app/features/ui/components/form/ColorPickerField';

const ACTIVE_PERSONA_TABS: Array<SegmentedTab<ActivePersonaMode>> = [
	{id: 'off', label: 'Off'},
	{id: 'manual', label: 'Manual'},
	{id: 'last', label: 'Last Used'},
];

const ACTIVE_PERSONA_DESCRIPTIONS: Record<ActivePersonaMode, string> = {
	off: 'Untagged messages always send from your root account. Personas only speak when you type their tags (e.g. [text]).',
	manual:
		'Untagged messages send as your chosen persona. Typing another persona’s tags will only send that single message and won’t switch who is active.',
	last: 'Untagged messages send as the persona that spoke most recently. Whenever anyone uses a persona tag, they automatically become the active persona.',
};

interface PersonaFormState {
	id?: string;
	name: string;
	systemName: string;
	pronouns: string;
	avatarUrl: string;
	color: number | null;
	bio: string;
	tags: Array<{prefix: string; suffix: string}>;
}

const emptyFormState = (): PersonaFormState => ({
	name: '',
	systemName: '',
	pronouns: '',
	avatarUrl: '',
	color: null,
	bio: '',
	tags: [{prefix: '', suffix: ''}],
});

export const PersonaSettingsTab: React.FC = observer(() => {
	const currentUser = Users.getCurrentUser();
	const personas = PersonaStore.personas;
	const activePersonaId = PersonaStore.activePersonaId;
	const isLatched = PersonaStore.isPersonaLatched;

	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState<PersonaFormState>(emptyFormState());
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

	const handleAvatarUpload = async (base64: string) => {
		setFormData((prev) => ({...prev, avatarUrl: base64}));
		setIsUploadingAvatar(true);
		try {
			const res = await http.post<{avatar_url: string}>(Endpoints.USER_PERSONA_AVATAR, {
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
			color: persona.color ?? null,
			bio: persona.bio ?? '',
			tags:
				(persona.personaTags ?? []).length > 0
					? (persona.personaTags ?? []).map((t) => ({prefix: t.prefix ?? '', suffix: t.suffix ?? ''}))
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

		const parsedColor = formData.color;

		const validTags = formData.tags
			.map((t) => ({prefix: t.prefix.trim() || undefined, suffix: t.suffix.trim() || undefined}))
			.filter((t) => t.prefix || t.suffix);

		if (formData.id) {
			await PersonaStore.updatePersona(formData.id, {
				name: trimmedName,
				systemName: formData.systemName.trim() || undefined,
				pronouns: formData.pronouns.trim() || undefined,
				avatarUrl: formData.avatarUrl.trim() || undefined,
				color: parsedColor ?? undefined,
				bio: formData.bio.trim() || undefined,
				personaTags: validTags.map((t) => ({
					$typeName: 'fluxer.user.preferences.v1.PersonaTag',
					prefix: t.prefix,
					suffix: t.suffix,
				})),
			});
		} else {
			await PersonaStore.addPersona({
				name: trimmedName,
				system_name: formData.systemName.trim() || null,
				pronouns: formData.pronouns.trim() || null,
				avatar_url: formData.avatarUrl.trim() || null,
				color: parsedColor,
				bio: formData.bio.trim() || null,
				persona_tags: validTags,
			});
		}

		setIsEditing(false);
		setFormData(emptyFormState());
	};

	const handleDeletePersona = async (id: string) => {
		if (confirm('Are you sure you want to delete this persona?')) {
			await PersonaStore.deletePersona(id);
		}
	};

	const activePersonaMode = PersonaStore.activePersonaMode;

	const handleModeChange = async (mode: ActivePersonaMode) => {
		await PersonaStore.setActivePersonaMode(mode);
	};

	const handleToggleActive = async (personaId: string) => {
		if (activePersonaId === personaId && isLatched) {
			await PersonaStore.unlatch();
		} else {
			await PersonaStore.setActivePersona(personaId, true);
		}
	};

	const handleAddTagRow = () => {
		setFormData((prev) => ({
			...prev,
			tags: [...prev.tags, {prefix: '', suffix: ''}],
		}));
	};

	const handleRemoveTagRow = (index: number) => {
		setFormData((prev) => ({
			...prev,
			tags: prev.tags.filter((_, i) => i !== index),
		}));
	};

	const handleTagChange = (index: number, field: 'prefix' | 'suffix', value: string) => {
		setFormData((prev) => {
			const updated = [...prev.tags];
			updated[index] = {...updated[index], [field]: value};
			return {...prev, tags: updated};
		});
	};

	return (
		<SettingsTabContainer data-flx="user.personas-settings-tab.container">
			<SettingsTabContent data-flx="user.personas-settings-tab.content">
				<div className={styles.container}>
					{/* Header section */}
					<SettingsSection
						id="personas_general"
						title="Personas"
						description="Send messages with distinct names and avatars. Personas can represent plural system members, roleplay characters, or any other identity."
						linkable={false}
					>
						<div className={styles.sectionHeader}>
							<div>
								<h4 className={styles.sectionTitle}>Active Persona Mode</h4>
								<p className={styles.sectionDescription}>
									Choose how untagged messages and persona tags interact with your active persona.
								</p>
							</div>
						</div>
						<div className={styles.modeControlWrapper}>
							<SegmentedTabs<ActivePersonaMode>
								tabs={ACTIVE_PERSONA_TABS}
								selectedTab={activePersonaMode}
								onTabChange={(mode) => {
									void handleModeChange(mode);
								}}
								ariaLabel="Active persona mode"
							/>
							<div className={styles.modeHelperText}>
								<Info size={16} weight="bold" className={styles.modeHelperIcon} />
								<span>{ACTIVE_PERSONA_DESCRIPTIONS[activePersonaMode]}</span>
							</div>
						</div>
					</SettingsSection>

					{/* Editor Form */}
					{isEditing && (
						<div className={styles.editorCard}>
							<div className={styles.editorTitle}>{formData.id ? 'Edit Persona' : 'New Persona'}</div>
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
									<div className={styles.formLabel}>Color</div>
									<ColorPickerField
										value={formData.color ?? 0}
										onChange={(color) => setFormData((prev) => ({...prev, color: color === 0 ? null : color}))}
										onReset={() => setFormData((prev) => ({...prev, color: null}))}
										hideHelperText={true}
										data-flx="user.persona-settings-tab.color-picker-field"
									/>
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
										<div className={styles.formLabel}>Persona Tags (Prefix & Suffix)</div>
										<Button variant="secondary" small leftIcon={<Plus size={14} />} onClick={handleAddTagRow}>
											Add Tag Pair
										</Button>
									</div>
									{formData.tags.map((tag, idx) => (
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
											{formData.tags.length > 1 && (
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
									{isUploadingAvatar ? 'Uploading avatar...' : 'Save Persona'}
								</Button>
							</div>
						</div>
					)}

					{/* Personas List */}
					<SettingsSection
						id="personas_list"
						title={`Configured Personas (${personas.length})`}
						linkable={false}
						actions={
							!isEditing && (
								<div style={{display: 'flex', gap: 8}}>
									<Button
										variant="secondary"
										leftIcon={<UploadSimple size={16} />}
										onClick={openPluralKitImportModal}
									>
										Import from PluralKit
									</Button>
									<Button
										variant="primary"
										leftIcon={<Plus size={16} />}
										onClick={handleStartAdd}
									>
										Add Persona
									</Button>
								</div>
							)
						}
					>
						{personas.length === 0 && !isEditing ? (
							<div className={styles.emptyState}>
								No personas created yet. Click "Add Persona" to create your first persona!
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
													{persona.color != null && persona.color !== 0 && (
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
													{(persona.personaTags ?? []).map((t, idx) => (
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
													leftIcon={
														isThisActive ? (
															<LockSimple size={14} color="var(--brand-primary)" />
														) : (
															<LockSimpleOpen size={14} />
														)
													}
													aria-label={isThisActive ? 'Deactivate persona' : 'Set as active persona'}
												>
													{isThisActive ? 'Active' : 'Set Active'}
												</Button>
												<Button
													variant="secondary"
													leftIcon={<PencilSimple size={14} />}
													onClick={() => handleStartEdit(persona)}
													aria-label="Edit persona"
												>
													Edit
												</Button>
												<Button
													variant="danger"
													leftIcon={<Trash size={14} />}
													onClick={() => handleDeletePersona(persona.id)}
													aria-label="Delete persona"
												>
													Delete
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
export default PersonaSettingsTab;
export const SubprofileSettingsTab = PersonaSettingsTab;
