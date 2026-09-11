// SPDX-License-Identifier: AGPL-3.0-or-later

import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import {Avatar} from '@app/features/ui/components/Avatar';
import {type SegmentedTab, SegmentedTabs} from '@app/features/ui/segmented_tabs/SegmentedTabs';
import {UserSettingsModal} from '@app/features/user/components/modals/UserSettingsModal';
import Users from '@app/features/user/state/Users';
import {Check, Gear, MagnifyingGlass} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo, useState} from 'react';
import {type ActivePersonaMode, PersonaStore} from '../state/PersonaStore';
import styles from './PersonaPickerSheet.module.css';

const ACTIVE_PERSONA_TABS: Array<SegmentedTab<ActivePersonaMode>> = [
	{id: 'off', label: 'Off'},
	{id: 'manual', label: 'Manual'},
	{id: 'last', label: 'Last Used'},
];

interface PersonaPickerSheetProps {
	onClose: () => void;
	selectedPersonaId?: string;
	showModes?: boolean;
	onSelectPersona: (id: string) => void;
	onSelectAccount: () => void;
}

export const PersonaPickerSheet: React.FC<PersonaPickerSheetProps> = observer(
	({onClose, selectedPersonaId, showModes = false, onSelectPersona, onSelectAccount}) => {
		const [query, setQuery] = useState('');
		const currentUser = Users.getCurrentUser();
		const personas = PersonaStore.personas;
		const activePersonaId = selectedPersonaId || (selectedPersonaId === '' ? null : PersonaStore.activePersonaId);
		const isLatched = selectedPersonaId ? true : PersonaStore.isPersonaLatched;
		const activePersonaMode = PersonaStore.activePersonaMode;
		const rankedPersonas = PersonaStore.rankedPersonas;

		const filteredPersonas = useMemo(() => {
			const trimmed = query.trim().toLowerCase();
			if (!trimmed) return personas;
			return personas.filter((p) => {
				if (p.name.toLowerCase().includes(trimmed)) return true;
				if (p.systemName?.toLowerCase().includes(trimmed)) return true;
				if (p.pronouns?.toLowerCase().includes(trimmed)) return true;
				return (p.personaTags ?? []).some(
					(tag) => tag.prefix?.toLowerCase().includes(trimmed) || tag.suffix?.toLowerCase().includes(trimmed),
				);
			});
		}, [personas, query]);

		const recentShelfPersonas = useMemo(() => {
			if (query.trim()) return [];
			return rankedPersonas.slice(0, 5);
		}, [rankedPersonas, query]);

		const handleSelectPersona = (id: string) => {
			onSelectPersona(id);
			onClose();
		};

		const handleResetToRoot = () => {
			onSelectAccount();
			onClose();
		};

		const handleOpenSettings = () => {
			ModalCommands.push(modal(() => <UserSettingsModal initialTab="personas" />));
			onClose();
		};

		return (
			<div className={styles.sheetContainer} data-flx="persona.picker-sheet">
				<div className={styles.searchHeader}>
					<div className={styles.searchInputWrapper}>
						<MagnifyingGlass className={styles.searchIcon} size={16} weight="bold" />
						<input
							type="text"
							className={styles.searchInput}
							placeholder="Search personas, tags, pronouns..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
					</div>
				</div>

				{showModes && (
					<div className={styles.modeTabsWrapper}>
						<SegmentedTabs<ActivePersonaMode>
							className={styles.segmentedTabs}
							tabs={ACTIVE_PERSONA_TABS}
							selectedTab={activePersonaMode}
							onTabChange={(mode) => {
								void PersonaStore.setActivePersonaMode(mode);
							}}
							ariaLabel="Active persona mode"
						/>
					</div>
				)}

				<div className={styles.listScrollArea}>
					{/* Reset to Root Account */}
					{currentUser && (
						<div
							className={clsx(styles.personaItem, (!isLatched || !activePersonaId) && styles.active)}
							onClick={handleResetToRoot}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleResetToRoot();
								}
							}}
							role="button"
							tabIndex={0}
						>
							<Avatar user={currentUser} size={28} />
							<div className={styles.personaDetails}>
								<div className={styles.personaPrimaryRow}>
									<span className={styles.personaName}>{currentUser.username}</span>
								</div>
								<span className={styles.personaPronouns}>Root Account (Default)</span>
							</div>
							{!isLatched || !activePersonaId ? <Check size={16} weight="bold" className={styles.activeCheck} /> : null}
						</div>
					)}

					{/* Recent Personas Shelf */}
					{recentShelfPersonas.length > 0 && (
						<>
							<div className={styles.sectionTitle}>Recent Personas</div>
							<div className={styles.recentShelf}>
								{recentShelfPersonas.map((p) => (
									<div
										key={p.id}
										className={styles.recentChip}
										onClick={() => handleSelectPersona(p.id)}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleSelectPersona(p.id);
											}
										}}
										role="button"
										tabIndex={0}
									>
										{currentUser && <Avatar user={currentUser} avatarUrl={p.avatarUrl} size={18} />}
										<span>{p.name}</span>
									</div>
								))}
							</div>
						</>
					)}

					{/* Full Persona List */}
					<div className={styles.sectionTitle}>
						{query.trim() ? `Search Results (${filteredPersonas.length})` : 'All Personas'}
					</div>

					{filteredPersonas.length === 0 ? (
						<div className={styles.emptyNotice}>
							{personas.length === 0
								? 'No personas configured yet. Create one in Settings.'
								: 'No matching personas found.'}
						</div>
					) : (
						filteredPersonas.map((p) => {
							const isThisActive = isLatched && activePersonaId === p.id;
							const primaryTag = p.personaTags?.[0];
							const tagString = primaryTag ? `${primaryTag.prefix ?? ''}text${primaryTag.suffix ?? ''}` : undefined;

							return (
								<div
									key={p.id}
									className={clsx(styles.personaItem, isThisActive && styles.active)}
									onClick={() => handleSelectPersona(p.id)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											handleSelectPersona(p.id);
										}
									}}
									role="button"
									tabIndex={0}
								>
									{currentUser && <Avatar user={currentUser} avatarUrl={p.avatarUrl} size={28} />}
									<div className={styles.personaDetails}>
										<div className={styles.personaPrimaryRow}>
											<span className={styles.personaName}>{p.name}</span>
											{p.systemName && <span className={styles.tagBadge}>[{p.systemName}]</span>}
										</div>
										<div className={styles.personaPrimaryRow}>
											{p.pronouns && <span className={styles.personaPronouns}>{p.pronouns}</span>}
											{tagString && <span className={styles.tagBadge}>{tagString}</span>}
										</div>
									</div>
									{isThisActive && <Check size={16} weight="bold" className={styles.activeCheck} />}
								</div>
							);
						})
					)}
				</div>

				<div className={styles.footer}>
					<button type="button" className={styles.settingsLink} onClick={handleOpenSettings}>
						<Gear size={14} />
						<span>Manage Personas</span>
					</button>
				</div>
			</div>
		);
	},
);

export const SubprofilePickerSheet = PersonaPickerSheet;
