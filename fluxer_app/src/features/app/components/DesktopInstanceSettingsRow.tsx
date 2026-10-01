// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/app/components/DesktopInstanceSettingsRow.module.css';
import {openInstanceSwitcherModal} from '@app/features/app/components/dialogs/DesktopInstanceSwitcherModal';
import {Button} from '@app/features/ui/button/Button';
import {isDesktop} from '@app/features/ui/utils/NativeUtils';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useEffect, useState} from 'react';

const SERVER_INSTANCE_TITLE_DESCRIPTOR = msg({
	message: 'Current server instance',
	comment: 'Title for current homeserver in desktop settings.',
});

const CONNECTED_TO_URL_DESCRIPTOR = msg({
	message: 'Connected to {url}. Changing server instance reloads the application.',
	comment: 'Description in desktop settings row showing current server instance and reload notice.',
});

const CHANGE_SERVER_BUTTON_DESCRIPTOR = msg({
	message: 'Change server',
	comment: 'Button to open server instance switcher modal.',
});

const RESET_TO_DEFAULT_BUTTON_DESCRIPTOR = msg({
	message: 'Reset to default',
	comment: 'Button to reset desktop app to default homeserver.',
});

export const DesktopInstanceSettingsRow: React.FC = observer(() => {
	const {i18n} = useLingui();
	const [currentUrl, setCurrentUrl] = useState<string>('https://temple.hypersystem.xyz');
	const [defaultUrl, setDefaultUrl] = useState<string>('https://temple.hypersystem.xyz');
	const [busy, setBusy] = useState<boolean>(false);

	useEffect(() => {
		let isMounted = true;
		const load = async () => {
			if (!isDesktop() || !window.electron?.getInstanceUrl) return;
			try {
				const [loadedCurrent, loadedDefault] = await Promise.all([
					window.electron.getInstanceUrl(),
					window.electron.getDefaultInstanceUrl ? window.electron.getDefaultInstanceUrl() : 'https://temple.hypersystem.xyz',
				]);
				if (isMounted) {
					setCurrentUrl(loadedCurrent);
					setDefaultUrl(loadedDefault);
				}
			} catch {
				// Ignore
			}
		};
		load();
		return () => {
			isMounted = false;
		};
	}, []);

	const handleReset = useCallback(async () => {
		if (!isDesktop() || !window.electron?.resetInstanceUrl) return;
		setBusy(true);
		try {
			await window.electron.resetInstanceUrl();
		} catch {
			setBusy(false);
		}
	}, []);

	if (!isDesktop()) return null;

	return (
		<div className={styles.row} data-flx="app.desktop-instance-settings-row.row">
			<div className={styles.text} data-flx="app.desktop-instance-settings-row.text">
				<div className={styles.title} data-flx="app.desktop-instance-settings-row.title">
					{i18n._(SERVER_INSTANCE_TITLE_DESCRIPTOR)}
				</div>
				<p className={styles.description} data-flx="app.desktop-instance-settings-row.description">
					{i18n._(CONNECTED_TO_URL_DESCRIPTOR, {url: currentUrl})}
				</p>
			</div>
			<div className={styles.buttonGroup} data-flx="app.desktop-instance-settings-row.button-group">
				{currentUrl !== defaultUrl && (
					<Button
						variant="ghost"
						small
						disabled={busy}
						onClick={handleReset}
						data-flx="app.desktop-instance-settings-row.button.reset"
					>
						{i18n._(RESET_TO_DEFAULT_BUTTON_DESCRIPTOR)}
					</Button>
				)}
				<Button
					variant="secondary"
					small
					onClick={openInstanceSwitcherModal}
					data-flx="app.desktop-instance-settings-row.button.change"
				>
					{i18n._(CHANGE_SERVER_BUTTON_DESCRIPTOR)}
				</Button>
			</div>
		</div>
	);
});
