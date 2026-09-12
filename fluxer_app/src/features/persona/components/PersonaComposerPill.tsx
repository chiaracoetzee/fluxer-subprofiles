// SPDX-License-Identifier: AGPL-3.0-or-later

import {Avatar} from '@app/features/ui/components/Avatar';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {Popout} from '@app/features/ui/popover/PopoverPopout';
import Users from '@app/features/user/state/Users';
import {LockSimple} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {PersonaStore} from '../state/PersonaStore';
import styles from './PersonaComposerPill.module.css';
import {PersonaPickerSheet} from './PersonaPickerSheet';

interface PersonaComposerPillProps {
	channelId?: string;
	className?: string;
	text?: string;
	hasAttachments?: boolean;
}

export const PersonaComposerPill: React.FC<PersonaComposerPillProps> = observer(
	({className, text = '', hasAttachments = false}) => {
		const currentUser = Users.getCurrentUser();
		const personas = PersonaStore.personas;
		const activePersona = PersonaStore.activePersona;
		const isLatched = PersonaStore.isPersonaLatched && Boolean(activePersona);
		const mode = PersonaStore.activePersonaMode;

		// Hide if user has no personas configured
		if (!currentUser || personas.length === 0) {
			return null;
		}

		const {persona: effectivePersona, isFromTag} = PersonaStore.getEffectivePersonaForText(text, hasAttachments);

		const avatarUrl = effectivePersona
			? (effectivePersona.avatarUrl ?? effectivePersona.avatar_url ?? undefined)
			: undefined;
		const modeLabel = mode === 'last' ? 'Last Used' : mode === 'manual' ? 'Manual' : 'Off';

		let tooltipText: string;
		if (isFromTag && effectivePersona) {
			tooltipText = `Sending as ${effectivePersona.name} (Matched by tag) - Click to switch persona`;
		} else if (isLatched && activePersona) {
			tooltipText = `${activePersona.name} (${modeLabel}) - Click to switch persona`;
		} else {
			tooltipText = `Sending as @${currentUser.username} (${modeLabel}) - Click to switch persona`;
		}

		return (
			<div className={clsx(styles.pillContainer, className)} data-flx="persona.composer-pill">
				<Popout
					position="top-start"
					offsetMainAxis={8}
					tooltip={tooltipText}
					tooltipPosition="top"
					render={({onClose}) => (
						<PersonaPickerSheet
							onClose={onClose}
							showModes={true}
							onSelectPersona={(id) => {
								void PersonaStore.setActivePersona(id, true);
							}}
							onSelectAccount={() => {
								void PersonaStore.unlatch();
							}}
						/>
					)}
				>
					<FocusRing offset={-2}>
						<button
							type="button"
							className={clsx(
								styles.pillButton,
								isLatched && !isFromTag && styles.latched,
								isFromTag && styles.tagMatched,
							)}
							aria-label={tooltipText}
						>
							<Avatar user={currentUser} avatarUrl={avatarUrl} size={24} />
							{isLatched && !isFromTag && (
								<div className={styles.latchBadge}>
									<LockSimple size={8} weight="bold" />
								</div>
							)}
						</button>
					</FocusRing>
				</Popout>
			</div>
		);
	},
);

export const SubprofileComposerPill = PersonaComposerPill;
