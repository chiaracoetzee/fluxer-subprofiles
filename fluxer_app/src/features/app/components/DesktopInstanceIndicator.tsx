// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/app/components/DesktopInstanceIndicator.module.css';
import {openInstanceSwitcherModal} from '@app/features/app/components/dialogs/DesktopInstanceSwitcherModal';
import {isDesktop} from '@app/features/ui/utils/NativeUtils';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {GlobeIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import React, {useEffect, useMemo, useState} from 'react';

const CONNECTED_TO_SERVER_DESCRIPTOR = msg({
	message: 'Connected to {server}',
	comment: 'Label showing which homeserver the desktop client is currently connected to. {server} is the hostname.',
});

const CHANGE_SERVER_DESCRIPTOR = msg({
	message: 'Change',
	comment: 'Button to change homeserver instance.',
});

export const DesktopInstanceIndicator: React.FC = observer(() => {
	const {i18n} = useLingui();
	const [serverUrl, setServerUrl] = useState<string>('');

	useEffect(() => {
		let isMounted = true;
		const loadUrl = async () => {
			if (!isDesktop() || !window.electron?.getInstanceUrl) return;
			try {
				const url = await window.electron.getInstanceUrl();
				if (isMounted) {
					setServerUrl(url);
				}
			} catch {
				// Ignore
			}
		};
		loadUrl();
		return () => {
			isMounted = false;
		};
	}, []);

	const displayHost = useMemo(() => {
		const raw = serverUrl || (typeof window !== 'undefined' ? window.location.origin : '');
		try {
			return new URL(raw).hostname || raw;
		} catch {
			return raw;
		}
	}, [serverUrl]);

	if (!isDesktop()) {
		return null;
	}

	return (
		<div className={styles.container} data-flx="app.desktop-instance-indicator.container">
			<GlobeIcon size={14} className={styles.icon} data-flx="app.desktop-instance-indicator.icon" />
			<span className={styles.serverText} data-flx="app.desktop-instance-indicator.text">
				{i18n._(CONNECTED_TO_SERVER_DESCRIPTOR, {server: displayHost})}
			</span>
			<button
				type="button"
				className={styles.changeButton}
				onClick={openInstanceSwitcherModal}
				data-flx="app.desktop-instance-indicator.change-button"
			>
				({i18n._(CHANGE_SERVER_DESCRIPTOR)})
			</button>
		</div>
	);
});
