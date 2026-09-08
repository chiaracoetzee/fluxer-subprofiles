// SPDX-License-Identifier: AGPL-3.0-or-later

import {Avatar} from '@app/features/ui/components/Avatar';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {Popout} from '@app/features/ui/popover/PopoverPopout';
import Users from '@app/features/user/state/Users';
import {LockSimple} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {SubprofileStore} from '../state/SubprofileStore';
import styles from './SubprofileComposerPill.module.css';
import {SubprofilePickerSheet} from './SubprofilePickerSheet';

interface SubprofileComposerPillProps {
	channelId?: string;
	className?: string;
}

export const SubprofileComposerPill: React.FC<SubprofileComposerPillProps> = observer(({className}) => {
	const currentUser = Users.getCurrentUser();
	const personas = SubprofileStore.personas;
	const activePersona = SubprofileStore.activePersona;
	const isLatched = SubprofileStore.autoproxyLatched && Boolean(activePersona);
	const mode = SubprofileStore.autoproxyMode;

	// Hide if user has no personas configured
	if (!currentUser || personas.length === 0) {
		return null;
	}

	const avatarUrl = isLatched && activePersona ? activePersona.avatarUrl : undefined;
	const modeLabel = mode === 'last' ? 'Last Used' : mode === 'manual' ? 'Manual' : 'Off';
	const tooltipText =
		isLatched && activePersona
			? `${activePersona.name} (${modeLabel}) - Click to switch subprofile`
			: `Sending as @${currentUser.username} (Off) - Click to switch subprofile`;

	return (
		<div className={clsx(styles.pillContainer, className)} data-flx="subprofile.composer-pill">
			<Popout
				position="top-start"
				offsetMainAxis={8}
				tooltip={tooltipText}
				tooltipPosition="top"
				render={({onClose}) => <SubprofilePickerSheet onClose={onClose} />}
			>
				<FocusRing offset={-2}>
					<button
						type="button"
						className={clsx(styles.pillButton, isLatched && styles.latched)}
						aria-label={tooltipText}
					>
						<Avatar user={currentUser} avatarUrl={avatarUrl} size={24} />
						{isLatched && (
							<div className={styles.latchBadge}>
								<LockSimple size={8} weight="bold" />
							</div>
						)}
					</button>
				</FocusRing>
			</Popout>
		</div>
	);
});
