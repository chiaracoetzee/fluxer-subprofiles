// SPDX-License-Identifier: AGPL-3.0-or-later

import {ConfirmModal} from '@app/features/app/components/dialogs/ConfirmModal';
import {SettingsSection} from '@app/features/app/components/dialogs/shared/SettingsSection';
import {SettingsTabContainer, SettingsTabContent} from '@app/features/app/components/dialogs/shared/SettingsTabLayout';
import {
	AVATAR_RECOMMENDED_SIZE_LABEL,
	IMAGE_MAX_SIZE_LABEL,
	STATIC_IMAGE_FORMATS,
} from '@app/features/app/config/I18nDisplayConstants';
import {Endpoints} from '@app/features/app/constants/Endpoints';
import {AssetCropModal, AssetType} from '@app/features/expressions/components/modals/AssetCropModal';
import {openAssetSourceModal} from '@app/features/expressions/components/modals/AssetSourceModal';
import {isAnimatedFile} from '@app/features/expressions/utils/AnimatedImageUtils';
import {getAcceptString} from '@app/features/expressions/utils/AssetFormatCopy';
import {formatImageUploadRecommendedHint} from '@app/features/expressions/utils/AssetUploadHintCopy';
import {downloadGifAsImageFile} from '@app/features/expressions/utils/GifFileDownload';
import {isSvgFile, readImageFileAsUploadDataUrl} from '@app/features/expressions/utils/ImageUploadFileUtils';
import {openFilePicker} from '@app/features/messaging/utils/FilePickerUtils';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {Avatar} from '@app/features/ui/components/Avatar';
import {ColorPickerField} from '@app/features/ui/components/form/ColorPickerField';
import {type SegmentedTab, SegmentedTabs} from '@app/features/ui/segmented_tabs/SegmentedTabs';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import {AvatarUploader} from '@app/features/user/components/modals/tabs/my_profile_tab/AvatarUploader';
import Users from '@app/features/user/state/Users';
import * as AvatarUtils from '@app/features/user/utils/AvatarUtils';
import type {PersonaVisibility} from '@fluxer/schema/src/domains/persona/PersonaApiSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {
	GlobeSimple,
	Info,
	LockSimple,
	LockSimpleOpen,
	PencilSimple,
	Plus,
	Trash,
	UploadSimple,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';
import * as PersonaCommands from '../../commands/PersonaCommands';
import {type ActivePersonaMode, type Persona, PersonaStore} from '../../state/PersonaStore';
import {openPluralKitImportModal} from '../modals/PluralKitImportModal';
import {PersonaTag} from '../PersonaTag';
import styles from './PersonaSettingsTab.module.css';

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

const VISIBILITY_TABS: Array<SegmentedTab<PersonaVisibility>> = [
	{id: 'unlisted', label: 'Unlisted'},
	{id: 'public', label: 'Public'},
	{id: 'private', label: 'Private'},
];

const VISIBILITY_DESCRIPTIONS: Record<PersonaVisibility, string> = {
	unlisted:
		'Profile cards are accessible only when clicking on messages sent by this persona. Not listed in your public persona list.',
	public:
		'Profile cards are accessible when clicking on messages and visible in your public personas list to friends and mutual servers.',
	private: 'Only visible to you. Others cannot view this persona’s full bio or profile details.',
};

interface PersonaFormState {
	id?: string;
	name: string;
	pronouns: string;
	avatarUrl: string;
	accentColor: number | null;
	bio: string;
	visibility: PersonaVisibility;
	tags: Array<{prefix: string; suffix: string}>;
}

const emptyFormState = (): PersonaFormState => ({
	name: '',
	pronouns: '',
	avatarUrl: '',
	accentColor: null,
	bio: '',
	visibility: 'unlisted',
	tags: [{prefix: '', suffix: ''}],
});

export interface PersonaSettingsTabProps {
	initialSubtab?: string;
}

export const PersonaSettingsTab: React.FC<PersonaSettingsTabProps> = observer(({initialSubtab}) => {
	const {i18n} = useLingui();
	const currentUser = Users.getCurrentUser();
	const personas = PersonaStore.personas;
	const activePersonaId = PersonaStore.activePersonaId;
	const isLatched = PersonaStore.isPersonaLatched;

	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState<PersonaFormState>(emptyFormState());
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

	const [tagText, setTagText] = useState(PersonaStore.displayTagText);
	const [tagIcon, setTagIcon] = useState(PersonaStore.displayTagIcon);
	const [isUploadingTagIcon, setIsUploadingTagIcon] = useState(false);

	useEffect(() => {
		setTagText(PersonaStore.displayTagText);
	}, [PersonaStore.displayTagText]);

	useEffect(() => {
		setTagIcon(PersonaStore.displayTagIcon);
	}, [PersonaStore.displayTagIcon]);

	const handleTagTextChange = (value: string) => {
		setTagText(value);
		void PersonaStore.setDisplayTag(value, tagIcon);
	};

	const handleTagIconUpload = useCallback(
		async (base64: string) => {
			setIsUploadingTagIcon(true);
			try {
				const res = await http.post<{avatar_url: string}>(Endpoints.USER_PERSONA_AVATAR, {
					body: {avatar: base64},
				});
				if (res.ok && res.body?.avatar_url) {
					const newIcon = res.body.avatar_url;
					setTagIcon(newIcon);
					await PersonaStore.setDisplayTag(tagText, newIcon);
					ToastCommands.createToast({
						type: 'success',
						children: 'Display tag icon updated',
					});
				} else {
					ToastCommands.createToast({
						type: 'error',
						children: 'Failed to upload icon to server',
					});
				}
			} catch {
				ToastCommands.createToast({
					type: 'error',
					children: 'Failed to upload icon to server',
				});
			} finally {
				setIsUploadingTagIcon(false);
			}
		},
		[tagText],
	);

	const handleClearTagIcon = useCallback(async () => {
		setTagIcon(null);
		await PersonaStore.setDisplayTag(tagText, null);
		ToastCommands.createToast({
			type: 'success',
			children: 'Display tag icon removed',
		});
	}, [tagText]);

	const processTagIconFile = useCallback(
		async (file: File) => {
			if (file.size > 10 * 1024 * 1024) {
				ToastCommands.createToast({
					type: 'error',
					children: 'Icon file is too large. Choose an image smaller than 10MB.',
				});
				return;
			}
			const svg = isSvgFile(file);
			const animated = svg ? false : await isAnimatedFile(file);
			const base64 = svg ? await readImageFileAsUploadDataUrl(file) : await AvatarUtils.fileToBase64(file);
			if (animated || svg) {
				await handleTagIconUpload(base64);
				return;
			}
			ModalCommands.push(
				modal(() => (
					<AssetCropModal
						assetType={AssetType.AVATAR}
						imageUrl={base64}
						sourceMimeType={file.type}
						onCropComplete={(croppedBlob) => {
							const reader = new FileReader();
							reader.onload = () => {
								const croppedBase64 = reader.result as string;
								void handleTagIconUpload(croppedBase64);
							};
							reader.readAsDataURL(croppedBlob);
						}}
						onSkip={() => {
							void handleTagIconUpload(base64);
						}}
						data-flx="user.persona-settings-tab.tag-icon.asset-crop-modal"
					/>
				)),
			);
		},
		[handleTagIconUpload],
	);

	const handleOpenTagIconUpload = useCallback(() => {
		openAssetSourceModal({
			title: 'Tag Icon',
			uploadHint: formatImageUploadRecommendedHint(i18n, {
				formats: STATIC_IMAGE_FORMATS,
				maxSize: IMAGE_MAX_SIZE_LABEL,
				recommendedSize: AVATAR_RECOMMENDED_SIZE_LABEL,
			}),
			onPickUpload: async () => {
				try {
					const [file] = await openFilePicker({accept: getAcceptString('avatar')});
					if (!file) return;
					await processTagIconFile(file);
				} catch {
					ToastCommands.createToast({
						type: 'error',
						children: 'Failed to select icon image',
					});
				}
			},
			onSelectGif: (gif) => {
				void (async () => {
					try {
						const file = await downloadGifAsImageFile(gif);
						await processTagIconFile(file);
					} catch {
						ToastCommands.createToast({
							type: 'error',
							children: 'Failed to select GIF icon',
						});
					}
				})();
			},
			showGifOption: true,
		});
	}, [i18n, processTagIconFile]);

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
			pronouns: persona.pronouns ?? '',
			avatarUrl: persona.avatar_url ?? persona.avatarUrl ?? '',
			accentColor: persona.color ?? null,
			bio: persona.bio ?? '',
			visibility: persona.visibility ?? 'unlisted',
			tags:
				(persona.persona_tags ?? persona.personaTags ?? []).length > 0
					? (persona.persona_tags ?? persona.personaTags ?? []).map((t) => ({
							prefix: t.prefix ?? '',
							suffix: t.suffix ?? '',
						}))
					: [{prefix: '', suffix: ''}],
		});
		setIsEditing(true);
	};

	const editorCardRef = useRef<HTMLDivElement | null>(null);
	const lastHandledSubtabRef = useRef<string | null>(null);

	const handleCancelEdit = () => {
		setIsEditing(false);
		setFormData(emptyFormState());
	};

	useEffect(() => {
		if (initialSubtab && lastHandledSubtabRef.current !== initialSubtab) {
			const target = personas.find((p) => p.id === initialSubtab);
			if (target) {
				lastHandledSubtabRef.current = initialSubtab;
				handleStartEdit(target);
				requestAnimationFrame(() => {
					editorCardRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
				});
			}
		}
	}, [initialSubtab, personas]);

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

		const parsedColor = formData.accentColor;

		const validTags = formData.tags
			.map((t) => ({prefix: t.prefix.trim() || undefined, suffix: t.suffix.trim() || undefined}))
			.filter((t) => t.prefix || t.suffix);

		try {
			if (formData.id) {
				await PersonaCommands.updatePersona(formData.id, {
					name: trimmedName,
					pronouns: formData.pronouns.trim() || null,
					avatar_url: formData.avatarUrl.trim() || null,
					color: parsedColor,
					bio: formData.bio.trim() || null,
					visibility: formData.visibility,
					persona_tags: validTags,
				});
				ToastCommands.createToast({
					type: 'success',
					children: 'Persona updated',
				});
			} else {
				await PersonaCommands.createPersona({
					name: trimmedName,
					pronouns: formData.pronouns.trim() || null,
					avatar_url: formData.avatarUrl.trim() || null,
					color: parsedColor,
					bio: formData.bio.trim() || null,
					visibility: formData.visibility,
					persona_tags: validTags,
				});
				ToastCommands.createToast({
					type: 'success',
					children: 'Persona created',
				});
			}

			setIsEditing(false);
			setFormData(emptyFormState());
		} catch {
			ToastCommands.createToast({
				type: 'error',
				children: 'Failed to save persona',
			});
		}
	};

	const handleDeletePersona = (persona: Persona) => {
		ModalCommands.push(
			modal(() => (
				<ConfirmModal
					title={<Trans>Delete Persona</Trans>}
					description={
						<Trans>
							Are you sure you want to delete <strong>{persona.name}</strong>? This action cannot be undone.
						</Trans>
					}
					primaryText={<Trans>Delete</Trans>}
					primaryVariant="danger"
					onPrimary={async () => {
						try {
							await PersonaCommands.deletePersona(persona.id);
							if (formData.id === persona.id) {
								setIsEditing(false);
								setFormData(emptyFormState());
							}
							ToastCommands.createToast({
								type: 'success',
								children: 'Persona deleted',
							});
						} catch {
							ToastCommands.createToast({
								type: 'error',
								children: 'Failed to delete persona',
							});
						}
					}}
				/>
			)),
		);
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

						{/* Display Tag section */}
						<div className={styles.sectionHeader} style={{marginTop: 24}}>
							<div>
								<h4 className={styles.sectionTitle}>Display Tag</h4>
								<p className={styles.sectionDescription}>
									Display tag will appear next to all persona names in messages. If no display tag is set, your account
									profile picture will be shown.
								</p>
							</div>
						</div>
						<div className={styles.displayTagControlWrapper}>
							<div className={styles.displayTagInputs}>
								<div className={styles.displayTagTextField}>
									<div className={styles.formLabel}>Tag Text</div>
									<input
										type="text"
										className={styles.textInput}
										placeholder="e.g. Wonderland"
										maxLength={32}
										value={tagText}
										onChange={(e) => handleTagTextChange(e.target.value)}
									/>
								</div>
								<div className={styles.displayTagIconField}>
									<div className={styles.formLabel}>Tag Icon</div>
									<div className={styles.tagIconRow}>
										{tagIcon ? (
											<>
												<img src={tagIcon} alt="Tag Icon" className={styles.tagIconImage} />
												<Button
													variant="secondary"
													small={true}
													onClick={handleOpenTagIconUpload}
													disabled={isUploadingTagIcon}
												>
													Change icon
												</Button>
												<Button
													variant="secondary"
													small={true}
													onClick={handleClearTagIcon}
													disabled={isUploadingTagIcon}
												>
													Remove icon
												</Button>
											</>
										) : (
											<Button
												variant="primary"
												small={true}
												onClick={handleOpenTagIconUpload}
												disabled={isUploadingTagIcon}
											>
												Upload icon
											</Button>
										)}
									</div>
								</div>
							</div>
							{/* Live Preview Card */}
							<div className={styles.previewContainer}>
								<div className={styles.previewLabel}>Preview</div>
								<div className={styles.previewCard}>
									{currentUser && <Avatar user={currentUser} size={40} className={styles.previewAvatar} />}
									<div className={styles.previewMessageContent}>
										<div className={styles.previewHeader}>
											<span className={styles.previewName}>Alice</span>
											{currentUser && (
												<PersonaTag
													subprofile={{
														id: 'preview',
														name: 'Alice',
														display_tag_text: tagText.trim(),
														display_tag_icon: tagIcon,
													}}
													rootUser={currentUser}
												/>
											)}
											<span className={styles.previewTimestamp}>— Today at 12:00 PM</span>
										</div>
										<div className={styles.previewBody}>
											{tagText.trim() || tagIcon
												? 'This is a preview of how your display tag will look in chat.'
												: 'No display tag configured. Messages will show your account profile picture.'}
										</div>
									</div>
								</div>
							</div>
						</div>
					</SettingsSection>

					{/* Editor Form */}
					{isEditing && (
						<div ref={editorCardRef} className={styles.editorCard}>
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
									<div className={styles.formLabel}>Accent color</div>
									<ColorPickerField
										description="Customizes the border and banner color on this persona's profile"
										value={formData.accentColor ?? 0}
										onChange={(accentColor) =>
											setFormData((prev) => ({...prev, accentColor: accentColor === 0 ? null : accentColor}))
										}
										onReset={() => setFormData((prev) => ({...prev, accentColor: null}))}
										data-flx="user.persona-settings-tab.accent-color-picker-field"
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
									<textarea
										className={styles.textareaInput}
										placeholder="Tell us about this persona..."
										maxLength={4096}
										rows={4}
										value={formData.bio}
										onChange={(e) => setFormData({...formData, bio: e.target.value})}
									/>
								</div>
								<div className={styles.formField} style={{gridColumn: '1 / -1'}}>
									<div className={styles.formLabel}>Visibility</div>
									<SegmentedTabs<PersonaVisibility>
										tabs={VISIBILITY_TABS}
										selectedTab={formData.visibility}
										onTabChange={(vis) => setFormData((prev) => ({...prev, visibility: vis}))}
										ariaLabel="Persona visibility"
									/>
									<div className={styles.modeHelperText} style={{marginTop: 6}}>
										<Info size={16} weight="bold" className={styles.modeHelperIcon} />
										<span>{VISIBILITY_DESCRIPTIONS[formData.visibility]}</span>
									</div>
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
									<Button variant="secondary" leftIcon={<UploadSimple size={16} />} onClick={openPluralKitImportModal}>
										Import from PluralKit
									</Button>
									<Button variant="primary" leftIcon={<Plus size={16} />} onClick={handleStartAdd}>
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
													{persona.visibility === 'public' && (
														<Tooltip text="Public persona" position="top">
															<span className={styles.visibilityIcon} role="img" aria-label="Public persona">
																<GlobeSimple size={14} weight="bold" className={styles.iconPublic} />
															</span>
														</Tooltip>
													)}
													{persona.visibility === 'private' && (
														<Tooltip text="Private persona" position="top">
															<span className={styles.visibilityIcon} role="img" aria-label="Private persona">
																<LockSimple size={14} weight="bold" className={styles.iconPrivate} />
															</span>
														</Tooltip>
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
													onClick={() => handleDeletePersona(persona)}
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
