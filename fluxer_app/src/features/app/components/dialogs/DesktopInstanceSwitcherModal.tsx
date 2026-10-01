// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/app/components/dialogs/DesktopInstanceSwitcherModal.module.css';
import * as Modal from '@app/features/app/components/dialogs/Modal';
import {CANCEL_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {Input} from '@app/features/ui/components/form/FormInput';
import {isDesktop} from '@app/features/ui/utils/NativeUtils';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {
	ArrowsClockwiseIcon,
	CheckCircleIcon,
	GlobeIcon,
	HardDrivesIcon,
	WarningCircleIcon,
} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useEffect, useState} from 'react';

const SWITCH_SERVER_INSTANCE_TITLE_DESCRIPTOR = msg({
	message: 'Switch server instance',
	comment: 'Title of modal allowing desktop users to change their homeserver instance URL.',
});

const SWITCH_SERVER_INSTANCE_DESCRIPTION = msg({
	message: 'Connect your desktop app to a custom homeserver or official instance.',
	comment: 'Description in modal explaining what changing server instance does.',
});

const TEMPLE_PRESET_TITLE_DESCRIPTOR = msg({
	message: 'Temple (Default)',
	comment: 'Label for default Temple production instance preset button.',
});

const DEV_PRESET_TITLE_DESCRIPTOR = msg({
	message: 'Dev (Staging)',
	comment: 'Label for development/staging instance preset button.',
});

const OFFICIAL_PRESET_TITLE_DESCRIPTOR = msg({
	message: 'Fluxer Official',
	comment: 'Label for upstream official Fluxer instance preset button.',
});

const SERVER_URL_LABEL_DESCRIPTOR = msg({
	message: 'Server URL',
	comment: 'Form label for the instance server URL input field.',
});

const TEST_CONNECTION_DESCRIPTOR = msg({
	message: 'Test connection',
	comment: 'Button label to test network reachability to the specified server instance.',
});

const TESTING_CONNECTION_DESCRIPTOR = msg({
	message: 'Testing connection...',
	comment: 'Status indicator while checking server reachability.',
});

const CONNECTION_SUCCESS_DESCRIPTOR = msg({
	message: 'Successfully reached server instance.',
	comment: 'Success status indicator when server instance responds to health probe.',
});

const CONNECTION_FAILED_DESCRIPTOR = msg({
	message: 'Could not reach server. Please verify the URL.',
	comment: 'Error status indicator when server instance probe fails.',
});

const CONNECT_AND_SWITCH_DESCRIPTOR = msg({
	message: 'Connect & switch',
	comment: 'Primary action button to save the new server instance and reload the desktop app.',
});

const RESET_TO_DEFAULT_DESCRIPTOR = msg({
	message: 'Reset to default',
	comment: 'Action button to reset desktop app to default homeserver.',
});

const DESKTOP_ONLY_DESCRIPTOR = msg({
	message: 'Server instance switching is only supported in the Fluxer Desktop application.',
	comment: 'Notice displayed if instance switcher modal is somehow opened outside of Electron desktop.',
});

export const DESKTOP_INSTANCE_MODAL_KEY = 'desktop-instance-switcher-modal';

export const PRESET_INSTANCES = [
	{
		id: 'temple',
		titleDescriptor: TEMPLE_PRESET_TITLE_DESCRIPTOR,
		url: 'https://temple.hypersystem.xyz',
	},
	{
		id: 'dev',
		titleDescriptor: DEV_PRESET_TITLE_DESCRIPTOR,
		url: 'https://chat-dev.hypersystem.xyz',
	},
	{
		id: 'official',
		titleDescriptor: OFFICIAL_PRESET_TITLE_DESCRIPTOR,
		url: 'https://web.fluxer.app',
	},
] as const;

export const DesktopInstanceSwitcherModal: React.FC = observer(() => {
	const {i18n} = useLingui();
	const [currentUrl, setCurrentUrl] = useState<string>('https://temple.hypersystem.xyz');
	const [defaultUrl, setDefaultUrl] = useState<string>('https://temple.hypersystem.xyz');
	const [inputUrl, setInputUrl] = useState<string>('https://temple.hypersystem.xyz');
	const [testing, setTesting] = useState<boolean>(false);
	const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState<boolean>(false);

	useEffect(() => {
		let isMounted = true;
		const loadUrls = async () => {
			if (!isDesktop() || !window.electron?.getInstanceUrl) return;
			try {
				const [loadedCurrent, loadedDefault] = await Promise.all([
					window.electron.getInstanceUrl(),
					window.electron.getDefaultInstanceUrl ? window.electron.getDefaultInstanceUrl() : 'https://temple.hypersystem.xyz',
				]);
				if (isMounted) {
					setCurrentUrl(loadedCurrent);
					setDefaultUrl(loadedDefault);
					setInputUrl(loadedCurrent);
				}
			} catch {
				// Fallback to defaults
			}
		};
		loadUrls();
		return () => {
			isMounted = false;
		};
	}, []);

	const handleTestConnection = useCallback(async () => {
		const target = inputUrl.trim();
		if (!target) return;
		setTesting(true);
		setTestResult(null);
		setErrorMessage(null);

		const normalizedTarget = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(target) ? target : `https://${target}`;
		const cleanTarget = normalizedTarget.replace(/\/+$/, '');

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 6000);
			const response = await fetch(`${cleanTarget}/api/v1/users/@me`, {
				method: 'GET',
				signal: controller.signal,
			}).finally(() => clearTimeout(timeoutId));

			// A valid Fluxer instance returns 401 Unauthorized or 200 OK
			if (response.status === 401 || response.status === 200 || response.headers.has('x-fluxer-version')) {
				setTestResult('success');
			} else {
				setTestResult('error');
				setErrorMessage(i18n._(CONNECTION_FAILED_DESCRIPTOR));
			}
		} catch {
			setTestResult('error');
			setErrorMessage(i18n._(CONNECTION_FAILED_DESCRIPTOR));
		} finally {
			setTesting(false);
		}
	}, [inputUrl, i18n]);

	const handleSave = useCallback(async () => {
		if (!isDesktop() || !window.electron?.setInstanceUrl) return;
		const target = inputUrl.trim();
		if (!target) return;
		setSubmitting(true);
		setErrorMessage(null);

		try {
			const result = await window.electron.setInstanceUrl(target);
			if (!result.success) {
				setErrorMessage(result.error ?? i18n._(CONNECTION_FAILED_DESCRIPTOR));
				setSubmitting(false);
			} else {
				ModalCommands.popWithKey(DESKTOP_INSTANCE_MODAL_KEY);
			}
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : String(err));
			setSubmitting(false);
		}
	}, [inputUrl, i18n]);

	const handleReset = useCallback(async () => {
		if (!isDesktop() || !window.electron?.resetInstanceUrl) return;
		setSubmitting(true);
		try {
			await window.electron.resetInstanceUrl();
			ModalCommands.popWithKey(DESKTOP_INSTANCE_MODAL_KEY);
		} catch (err) {
			setErrorMessage(err instanceof Error ? err.message : String(err));
			setSubmitting(false);
		}
	}, []);

	const handleCancel = useCallback(() => {
		ModalCommands.popWithKey(DESKTOP_INSTANCE_MODAL_KEY);
	}, []);

	if (!isDesktop()) {
		return (
			<Modal.Root size="medium" centered data-flx="app.desktop-instance-switcher-modal.modal-root">
				<Modal.Header title={i18n._(SWITCH_SERVER_INSTANCE_TITLE_DESCRIPTOR)} data-flx="app.desktop-instance-switcher-modal.modal-header" />
				<Modal.Content data-flx="app.desktop-instance-switcher-modal.modal-content">
					<Modal.ContentLayout data-flx="app.desktop-instance-switcher-modal.modal-content-layout">
						<Modal.Description data-flx="app.desktop-instance-switcher-modal.modal-description">{i18n._(DESKTOP_ONLY_DESCRIPTOR)}</Modal.Description>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer data-flx="app.desktop-instance-switcher-modal.modal-footer">
					<Button variant="secondary" onClick={handleCancel} data-flx="app.desktop-instance-switcher-modal.button.cancel">
						{i18n._(CANCEL_DESCRIPTOR)}
					</Button>
				</Modal.Footer>
			</Modal.Root>
		);
	}

	return (
		<Modal.Root size="medium" centered data-flx="app.desktop-instance-switcher-modal.modal-root--2">
			<Modal.Header title={i18n._(SWITCH_SERVER_INSTANCE_TITLE_DESCRIPTOR)} data-flx="app.desktop-instance-switcher-modal.modal-header--2" />
			<Modal.Content data-flx="app.desktop-instance-switcher-modal.modal-content--2">
				<Modal.ContentLayout data-flx="app.desktop-instance-switcher-modal.modal-content-layout--2">
					<Modal.Description data-flx="app.desktop-instance-switcher-modal.modal-description--2">{i18n._(SWITCH_SERVER_INSTANCE_DESCRIPTION)}</Modal.Description>
					<div className={styles.container} data-flx="app.desktop-instance-switcher-modal.container">
						<div className={styles.presetGrid} data-flx="app.desktop-instance-switcher-modal.preset-grid">
							{PRESET_INSTANCES.map((preset) => {
								const isActive = inputUrl.trim().replace(/\/+$/, '') === preset.url;
								return (
									<button
										key={preset.id}
										type="button"
										className={`${styles.presetCard} ${isActive ? styles.presetCardActive : ''}`}
										onClick={() => {
											setInputUrl(preset.url);
											setTestResult(null);
											setErrorMessage(null);
										}}
										data-flx="app.desktop-instance-switcher-modal.preset-card.set-input-url.button"
									>
										<div className={styles.presetTitle} data-flx="app.desktop-instance-switcher-modal.preset-title">
											<HardDrivesIcon size={16} data-flx="app.desktop-instance-switcher-modal.hard-drives-icon" />
											{i18n._(preset.titleDescriptor)}
										</div>
										<div className={styles.presetUrl} data-flx="app.desktop-instance-switcher-modal.preset-url">{preset.url}</div>
									</button>
								);
							})}
						</div>

						<Input
							label={i18n._(SERVER_URL_LABEL_DESCRIPTOR)}
							value={inputUrl}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
								setInputUrl(e.target.value);
								setTestResult(null);
								setErrorMessage(null);
							}}
							placeholder="https://temple.hypersystem.xyz"
							leftIcon={<GlobeIcon size={16} data-flx="app.desktop-instance-switcher-modal.globe-icon" />}
							error={errorMessage ?? undefined}
							data-flx="app.desktop-instance-switcher-modal.input"
						/>

						<div className={styles.testRow} data-flx="app.desktop-instance-switcher-modal.test-row">
							<Button
								variant="secondary"
								small
								disabled={testing || submitting || !inputUrl.trim()}
								onClick={handleTestConnection}
								leftIcon={testing ? <ArrowsClockwiseIcon size={14} data-flx="app.desktop-instance-switcher-modal.arrows-clockwise-icon" /> : undefined}
								data-flx="app.desktop-instance-switcher-modal.button.test-connection"
							>
								{testing ? i18n._(TESTING_CONNECTION_DESCRIPTOR) : i18n._(TEST_CONNECTION_DESCRIPTOR)}
							</Button>

							{testResult === 'success' && (
								<div className={`${styles.testStatus} ${styles.statusSuccess}`} data-flx="app.desktop-instance-switcher-modal.test-status">
									<CheckCircleIcon size={16} data-flx="app.desktop-instance-switcher-modal.check-circle-icon" />
									{i18n._(CONNECTION_SUCCESS_DESCRIPTOR)}
								</div>
							)}
							{testResult === 'error' && (
								<div className={`${styles.testStatus} ${styles.statusError}`} data-flx="app.desktop-instance-switcher-modal.test-status--2">
									<WarningCircleIcon size={16} data-flx="app.desktop-instance-switcher-modal.warning-circle-icon" />
									{i18n._(CONNECTION_FAILED_DESCRIPTOR)}
								</div>
							)}
						</div>
					</div>
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer data-flx="app.desktop-instance-switcher-modal.modal-footer--2">
				<div className={styles.footerWrapper} data-flx="app.desktop-instance-switcher-modal.footer-wrapper">
					{currentUrl !== defaultUrl ? (
						<Button variant="ghost" small disabled={submitting} onClick={handleReset} data-flx="app.desktop-instance-switcher-modal.button.reset">
							{i18n._(RESET_TO_DEFAULT_DESCRIPTOR)}
						</Button>
					) : (
						<div data-flx="app.desktop-instance-switcher-modal.div" />
					)}
					<div className={styles.footerRight} data-flx="app.desktop-instance-switcher-modal.footer-right">
						<Button variant="secondary" disabled={submitting} onClick={handleCancel} data-flx="app.desktop-instance-switcher-modal.button.cancel--2">
							{i18n._(CANCEL_DESCRIPTOR)}
						</Button>
						<Button variant="primary" submitting={submitting} disabled={!inputUrl.trim()} onClick={handleSave} data-flx="app.desktop-instance-switcher-modal.button.save">
							{i18n._(CONNECT_AND_SWITCH_DESCRIPTOR)}
						</Button>
					</div>
				</div>
			</Modal.Footer>
		</Modal.Root>
	);
});

export function openInstanceSwitcherModal(): void {
	ModalCommands.pushWithKey(
		ModalCommands.modal(() => <DesktopInstanceSwitcherModal data-flx="app.desktop-instance-switcher-modal.open-instance-switcher-modal.desktop-instance-switcher-modal" />),
		DESKTOP_INSTANCE_MODAL_KEY,
	);
}
