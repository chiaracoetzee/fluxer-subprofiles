// SPDX-License-Identifier: AGPL-3.0-or-later

import {SettingsSection} from '@app/features/app/components/dialogs/shared/SettingsSection';
import {SettingsTabContainer, SettingsTabContent} from '@app/features/app/components/dialogs/shared/SettingsTabLayout';
import {
	AVATAR_RECOMMENDED_SIZE_LABEL,
	IMAGE_MAX_SIZE_BYTES,
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
import {CLEAR_SEARCH_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import {openFilePicker} from '@app/features/messaging/utils/FilePickerUtils';
import {formatFileSize} from '@app/features/messaging/utils/FileUtils';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {Avatar} from '@app/features/ui/components/Avatar';
import {Input} from '@app/features/ui/components/form/FormInput';
import {type SegmentedTab, SegmentedTabs} from '@app/features/ui/segmented_tabs/SegmentedTabs';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import Users from '@app/features/user/state/Users';
import * as AvatarUtils from '@app/features/user/utils/AvatarUtils';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {
	CaretRight,
	GlobeSimple,
	Info,
	LockSimple,
	LockSimpleOpen,
	MagnifyingGlass,
	Plus,
	UploadSimple,
	X,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {type ActivePersonaMode, type Persona, PersonaStore} from '../../state/PersonaStore';
import {openPersonaEditModal} from '../modals/PersonaEditModal';
import {openPluralKitImportModal} from '../modals/PluralKitImportModal';
import {SEARCH_PERSONAS_PLACEHOLDER_DESCRIPTOR} from '../PersonaPickerSheet';
import {PersonaTag} from '../PersonaTag';
import styles from './PersonaSettingsTab.module.css';

const MODE_OFF_DESCRIPTOR = msg({
	message: 'Off',
	comment: 'Active persona mode off',
});
const MODE_MANUAL_DESCRIPTOR = msg({
	message: 'Manual',
	comment: 'Active persona mode manual',
});
const MODE_LAST_DESCRIPTOR = msg({
	message: 'Last Used',
	comment: 'Active persona mode last used',
});

const ACTIVE_PERSONA_MODE_OFF_DESC = msg({
	message: 'Untagged messages always send from your root account. Personas only speak when you type their tags (e.g. [text]).',
	comment: 'Helper description for Off persona mode',
});
const ACTIVE_PERSONA_MODE_MANUAL_DESC = msg({
	message: 'Untagged messages send as your chosen persona. Typing another persona’s tags will only send that single message and won’t switch who is active.',
	comment: 'Helper description for Manual persona mode',
});
const ACTIVE_PERSONA_MODE_LAST_DESC = msg({
	message: 'Untagged messages send as the persona that spoke most recently. Whenever anyone uses a persona tag, they automatically become the active persona.',
	comment: 'Helper description for Last Used persona mode',
});

const PERSONAS_SECTION_TITLE_DESCRIPTOR = msg({
	message: 'Personas',
	comment: 'Title of personas settings section',
});
const PERSONAS_SECTION_DESC_DESCRIPTOR = msg({
	message: 'Send messages with distinct names and avatars. Personas can represent plural system members, roleplay characters, or any other identity.',
	comment: 'Description of personas settings section',
});
const ACTIVE_PERSONA_MODE_ARIA_DESCRIPTOR = msg({
	message: 'Active persona mode',
	comment: 'Aria label for active persona mode tabs',
});

const DISPLAY_TAG_ICON_UPDATED_DESCRIPTOR = msg({
	message: 'Display tag icon updated',
	comment: 'Toast when display tag icon is updated',
});
const DISPLAY_TAG_ICON_REMOVED_DESCRIPTOR = msg({
	message: 'Display tag icon removed',
	comment: 'Toast when display tag icon is removed',
});
const FAILED_TO_UPLOAD_ICON_DESCRIPTOR = msg({
	message: 'Failed to upload icon to server',
	comment: 'Toast when icon upload fails',
});
const ICON_FILE_TOO_LARGE_DESCRIPTOR = msg({
	message: 'Icon file is too large. Choose an image smaller than 10MB.',
	comment: 'Toast when icon file exceeds size limit',
});
const PUBLIC_PERSONA_TOOLTIP_DESCRIPTOR = msg({
	message: 'Public persona',
	comment: 'Tooltip on public persona badge',
});
const PRIVATE_PERSONA_TOOLTIP_DESCRIPTOR = msg({
	message: 'Private persona',
	comment: 'Tooltip on private persona badge',
});
const SET_ACTIVE_PERSONA_ARIA_DESCRIPTOR = msg({
	message: 'Set as active persona',
	comment: 'Aria label for setting active persona',
});
const DEACTIVATE_PERSONA_ARIA_DESCRIPTOR = msg({
	message: 'Deactivate persona',
	comment: 'Aria label for deactivating active persona',
});
const EDIT_PERSONA_ARIA_DESCRIPTOR = msg({
	message: 'Edit persona',
	comment: 'Aria label for editing persona',
});
const CONFIG_PERSONAS_COUNT_DESCRIPTOR = msg({
	message: 'Configured Personas ({count})',
	comment: 'Header for configured personas list with count',
});

const getActivePersonaTabs = (i18n: I18n): Array<SegmentedTab<ActivePersonaMode>> => [
	{id: 'off', label: i18n._(MODE_OFF_DESCRIPTOR)},
	{id: 'manual', label: i18n._(MODE_MANUAL_DESCRIPTOR)},
	{id: 'last', label: i18n._(MODE_LAST_DESCRIPTOR)},
];

const getActivePersonaDescriptions = (i18n: I18n): Record<ActivePersonaMode, string> => ({
	off: i18n._(ACTIVE_PERSONA_MODE_OFF_DESC),
	manual: i18n._(ACTIVE_PERSONA_MODE_MANUAL_DESC),
	last: i18n._(ACTIVE_PERSONA_MODE_LAST_DESC),
});

export interface PersonaSettingsTabProps {
	initialSubtab?: string;
}

export const PersonaSettingsTab: React.FC<PersonaSettingsTabProps> = observer(({initialSubtab}) => {
	const {i18n} = useLingui();
	const personas = PersonaStore.personas;
	const activePersonaId = PersonaStore.activePersonaId;
	const isLatched = PersonaStore.isPersonaLatched;
	const activePersonaMode = PersonaStore.activePersonaMode;
	const currentUser = Users.currentUser;

	const [searchQuery, setSearchQuery] = useState('');

	// Display tag state
	const [tagText, setTagText] = useState(PersonaStore.displayTagText);
	const [tagIcon, setTagIcon] = useState(PersonaStore.displayTagIcon);
	const [isUploadingTagIcon, setIsUploadingTagIcon] = useState(false);

	useEffect(() => {
		setTagText(PersonaStore.displayTagText);
	}, [PersonaStore.displayTagText]);

	useEffect(() => {
		setTagIcon(PersonaStore.displayTagIcon);
	}, [PersonaStore.displayTagIcon]);

	// Deep link subtab support
	const lastHandledSubtabRef = useRef<string | null>(null);
	useEffect(() => {
		if (initialSubtab && lastHandledSubtabRef.current !== initialSubtab) {
			lastHandledSubtabRef.current = initialSubtab;
			if (initialSubtab === 'new') {
				openPersonaEditModal();
			} else {
				const target = personas.find((p) => p.id === initialSubtab);
				if (target) {
					openPersonaEditModal(target);
				}
			}
		}
	}, [initialSubtab, personas]);

	const activePersonaTabs = useMemo(() => getActivePersonaTabs(i18n), [i18n]);
	const activePersonaDescriptions = useMemo(() => getActivePersonaDescriptions(i18n), [i18n]);

	const filteredPersonaIds = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) {
			return personas.map((p) => p.id);
		}
		return personas
			.filter((p) => {
				const nameMatch = p.name.toLowerCase().includes(query);
				const pronounsMatch = (p.pronouns ?? '').toLowerCase().includes(query);
				const tags = p.persona_tags ?? p.personaTags ?? [];
				const tagMatch = tags.some(
					(t) => (t.prefix ?? '').toLowerCase().includes(query) || (t.suffix ?? '').toLowerCase().includes(query),
				);
				return nameMatch || pronounsMatch || tagMatch;
			})
			.map((p) => p.id);
	}, [personas, searchQuery]);

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
						children: i18n._(DISPLAY_TAG_ICON_UPDATED_DESCRIPTOR),
					});
				} else {
					ToastCommands.createToast({
						type: 'error',
						children: i18n._(FAILED_TO_UPLOAD_ICON_DESCRIPTOR),
					});
				}
			} catch {
				ToastCommands.createToast({
					type: 'error',
					children: i18n._(FAILED_TO_UPLOAD_ICON_DESCRIPTOR),
				});
			} finally {
				setIsUploadingTagIcon(false);
			}
		},
		[tagText, i18n],
	);

	const handleClearTagIcon = useCallback(async () => {
		setTagIcon(null);
		await PersonaStore.setDisplayTag(tagText, null);
		ToastCommands.createToast({
			type: 'success',
			children: i18n._(DISPLAY_TAG_ICON_REMOVED_DESCRIPTOR),
		});
	}, [tagText, i18n]);

	const processTagIconFile = useCallback(
		async (file: File) => {
			if (file.size > 10 * 1024 * 1024) {
				ToastCommands.createToast({
					type: 'error',
					children: i18n._(ICON_FILE_TOO_LARGE_DESCRIPTOR),
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
		[handleTagIconUpload, i18n],
	);

	const handleOpenTagIconUpload = useCallback(() => {
		openAssetSourceModal({
			title: 'Tag Icon',
			uploadHint: formatImageUploadRecommendedHint(i18n, {
				formats: STATIC_IMAGE_FORMATS,
				maxSize: formatFileSize(i18n.locale, IMAGE_MAX_SIZE_BYTES),
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

	const handleStartAdd = () => {
		openPersonaEditModal();
	};

	const handleStartEdit = (persona: Persona) => {
		openPersonaEditModal(persona);
	};

	return (
		<SettingsTabContainer data-flx="user.personas-settings-tab.container">
			<SettingsTabContent data-flx="user.personas-settings-tab.content">
				<div className={styles.container}>
					{/* Header section: Active Persona Mode */}
					<SettingsSection
						id="personas_general"
						title={i18n._(PERSONAS_SECTION_TITLE_DESCRIPTOR)}
						description={i18n._(PERSONAS_SECTION_DESC_DESCRIPTOR)}
						linkable={false}
					>
						<div className={styles.sectionHeader}>
							<div>
								<h4 className={styles.sectionTitle}>
									<Trans>Active Persona Mode</Trans>
								</h4>
								<p className={styles.sectionDescription}>
									<Trans>Choose how untagged messages and persona tags interact with your active persona.</Trans>
								</p>
							</div>
						</div>
						<div className={styles.modeControlWrapper}>
							<SegmentedTabs<ActivePersonaMode>
								tabs={activePersonaTabs}
								selectedTab={activePersonaMode}
								onTabChange={(mode) => {
									void handleModeChange(mode);
								}}
								ariaLabel={i18n._(ACTIVE_PERSONA_MODE_ARIA_DESCRIPTOR)}
							/>
							<div className={styles.modeHelperText}>
								<Info size={16} weight="bold" className={styles.modeHelperIcon} />
								<span>{activePersonaDescriptions[activePersonaMode]}</span>
							</div>
						</div>

						{/* Display Tag section */}
						<div className={styles.sectionHeader} style={{marginTop: 24}}>
							<div>
								<h4 className={styles.sectionTitle}>
									<Trans>Display Tag</Trans>
								</h4>
								<p className={styles.sectionDescription}>
									<Trans>
										Display tag will appear next to all persona names in messages. If no display tag is set, your
										account profile picture will be shown.
									</Trans>
								</p>
							</div>
						</div>

						<div className={styles.displayTagControlWrapper}>
							<div className={styles.displayTagInputs}>
								<div className={styles.displayTagTextField}>
									<div className={styles.formLabel}>
										<Trans>Tag Text</Trans>
									</div>
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
									<div className={styles.formLabel}>
										<Trans>Tag Icon</Trans>
									</div>
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
													<Trans>Change icon</Trans>
												</Button>
												<Button
													variant="secondary"
													small={true}
													onClick={handleClearTagIcon}
													disabled={isUploadingTagIcon}
												>
													<Trans>Remove icon</Trans>
												</Button>
											</>
										) : (
											<Button
												variant="primary"
												small={true}
												onClick={handleOpenTagIconUpload}
												disabled={isUploadingTagIcon}
											>
												<Trans>Upload icon</Trans>
											</Button>
										)}
									</div>
								</div>
							</div>
							{/* Live Preview Card */}
							<div className={styles.previewContainer}>
								<div className={styles.previewLabel}>
									<Trans>Preview</Trans>
								</div>
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
											<span className={styles.previewTimestamp}>
												<Trans>— Today at 12:00 PM</Trans>
											</span>
										</div>
										<div className={styles.previewBody}>
											{tagText.trim() || tagIcon ? (
												<Trans>This is a preview of how your display tag will look in chat.</Trans>
											) : (
												<Trans>No display tag configured. Messages will show your account profile picture.</Trans>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					</SettingsSection>

					{/* Personas List */}
					<SettingsSection
						id="personas_list"
						title={i18n._(CONFIG_PERSONAS_COUNT_DESCRIPTOR, {
							count: searchQuery.trim() ? filteredPersonaIds.length : personas.length,
						})}
						linkable={false}
						actions={
							<div style={{display: 'flex', gap: 8}}>
								<Button variant="secondary" leftIcon={<UploadSimple size={16} />} onClick={openPluralKitImportModal}>
									<Trans>Import from PluralKit</Trans>
								</Button>
								<Button variant="primary" leftIcon={<Plus size={16} />} onClick={handleStartAdd}>
									<Trans>Add Persona</Trans>
								</Button>
							</div>
						}
					>
						{personas.length > 0 && (
							<div className={styles.listControls}>
								<Input
									type="text"
									placeholder={i18n._(SEARCH_PERSONAS_PLACEHOLDER_DESCRIPTOR)}
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									leftIcon={<MagnifyingGlass size={16} weight="bold" className={styles.searchIcon} />}
									rightElement={
										searchQuery ? (
											<button
												type="button"
												onClick={() => setSearchQuery('')}
												className={styles.clearSearchButton}
												aria-label={i18n._(CLEAR_SEARCH_DESCRIPTOR)}
											>
												<X size={14} weight="bold" />
											</button>
										) : undefined
									}
									className={styles.searchInput}
									data-flx="user.persona-settings-tab.search-input"
								/>
							</div>
						)}

						{personas.length === 0 ? (
							<div className={styles.emptyState}>
								<Trans>No personas created yet. Click "Add Persona" to create your first persona!</Trans>
							</div>
						) : filteredPersonaIds.length === 0 ? (
							<div className={styles.emptyState}>
								<Trans>No matching personas found.</Trans>
							</div>
						) : (
							<div className={styles.cardList}>
								{filteredPersonaIds.map((personaId) => {
									const persona = PersonaStore.getPersona(personaId);
									if (!persona) return null;
									const isThisActive = activePersonaId === persona.id && isLatched;
									return (
										<div
											key={persona.id}
											className={clsx(styles.compactPersonaCard, isThisActive && styles.activeCard)}
											onClick={() => handleStartEdit(persona)}
										>
											{currentUser && <Avatar user={currentUser} avatarUrl={persona.avatarUrl} size={36} />}
											<div className={styles.cardDetails}>
												<div className={styles.cardPrimaryRow}>
													<span className={styles.cardName}>{persona.name}</span>
													{persona.pronouns && (
														<span className={styles.cardPronouns} title={persona.pronouns}>
															({persona.pronouns})
														</span>
													)}
													{persona.color != null && persona.color !== 0 && (
														<div
															className={styles.colorPreview}
															style={{
																width: 12,
																height: 12,
																backgroundColor: `#${persona.color.toString(16).padStart(6, '0')}`,
															}}
														/>
													)}
													{persona.visibility === 'public' && (
														<Tooltip text={i18n._(PUBLIC_PERSONA_TOOLTIP_DESCRIPTOR)} position="top">
															<span
																className={styles.visibilityIcon}
																role="img"
																aria-label={i18n._(PUBLIC_PERSONA_TOOLTIP_DESCRIPTOR)}
															>
																<GlobeSimple size={14} weight="bold" className={styles.iconPublic} />
															</span>
														</Tooltip>
													)}
													{persona.visibility === 'private' && (
														<Tooltip text={i18n._(PRIVATE_PERSONA_TOOLTIP_DESCRIPTOR)} position="top">
															<span
																className={styles.visibilityIcon}
																role="img"
																aria-label={i18n._(PRIVATE_PERSONA_TOOLTIP_DESCRIPTOR)}
															>
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
											<div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
												<Button
													variant="secondary"
													small={true}
													onClick={() => handleToggleActive(persona.id)}
													leftIcon={
														isThisActive ? (
															<LockSimple size={14} color="var(--brand-primary)" />
														) : (
															<LockSimpleOpen size={14} />
														)
													}
													aria-label={
														isThisActive
															? i18n._(DEACTIVATE_PERSONA_ARIA_DESCRIPTOR)
															: i18n._(SET_ACTIVE_PERSONA_ARIA_DESCRIPTOR)
													}
												>
													{isThisActive ? <Trans>Active</Trans> : <Trans>Set Active</Trans>}
												</Button>
												<button
													type="button"
													className={styles.chevronButton}
													onClick={() => handleStartEdit(persona)}
													aria-label={i18n._(EDIT_PERSONA_ARIA_DESCRIPTOR)}
												>
													<CaretRight size={18} weight="bold" />
												</button>
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
