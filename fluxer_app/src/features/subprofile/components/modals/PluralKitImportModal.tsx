// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import {Endpoints} from '@app/features/app/constants/Endpoints';
import {http} from '@app/features/platform/transport/RestTransport';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import type {Persona} from '@fluxer/schema/src/gen/fluxer/user/preferences/v1/preferences_pb';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';
import {CheckCircle, UploadSimple, Warning} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useRef, useState} from 'react';
import {SubprofileStore} from '../../state/SubprofileStore';
import styles from './PluralKitImportModal.module.css';

let importIdCounter = 0;

interface PKProxyTag {
	prefix?: string | null;
	suffix?: string | null;
}

interface PKMember {
	id?: string;
	name?: string;
	display_name?: string | null;
	color?: string | null;
	pronouns?: string | null;
	avatar_url?: string | null;
	webhook_avatar_url?: string | null;
	description?: string | null;
	proxy_tags?: Array<PKProxyTag>;
}

interface PKExport {
	version?: number;
	name?: string;
	tag?: string;
	members?: Array<PKMember>;
}

interface ImportWarning {
	displayName: string;
	prefix: string;
	reason: string;
}

interface PluralKitImportModalProps {
	onClose: () => void;
}

type Step = 'select' | 'importing' | 'completed';
type ImportMode = 'replace' | 'append';

export const PluralKitImportModal: React.FC<PluralKitImportModalProps> = observer(({onClose}) => {
	const existingCount = SubprofileStore.personas.length;

	const [step, setStep] = useState<Step>('select');
	const [fileError, setFileError] = useState<string | null>(null);
	const [pkData, setPkData] = useState<PKExport | null>(null);
	const [fileName, setFileName] = useState<string>('');
	const [importMode, setImportMode] = useState<ImportMode>(existingCount > 0 ? 'replace' : 'append');
	const [systemTagOverride, setSystemTagOverride] = useState<string>('');

	const [progress, setProgress] = useState({
		current: 0,
		total: 0,
		currentName: '',
		percent: 0,
	});

	const [importResults, setImportResults] = useState<{
		successCount: number;
		warnings: Array<ImportWarning>;
	}>({successCount: 0, warnings: []});

	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const handleFileChosen = (file: File) => {
		setFileError(null);
		setFileName(file.name);
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const content = e.target?.result as string;
				const parsed = JSON.parse(content) as PKExport;
				if (!parsed || !Array.isArray(parsed.members)) {
					setFileError('Invalid file: PluralKit export must contain a "members" list.');
					setPkData(null);
					return;
				}
				setPkData(parsed);
				setSystemTagOverride(parsed.tag?.trim() || parsed.name?.trim() || '');
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : 'Invalid JSON file';
				setFileError(`Failed to read file: ${msg}`);
				setPkData(null);
			}
		};
		reader.onerror = () => {
			setFileError('Failed to read the selected file.');
			setPkData(null);
		};
		reader.readAsText(file);
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			handleFileChosen(e.dataTransfer.files[0]);
		}
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
	};

	const handleStartImport = async () => {
		if (!pkData || !pkData.members || pkData.members.length === 0) return;

		setStep('importing');
		const members = pkData.members;
		const total = members.length;
		const warnings: Array<ImportWarning> = [];
		const importedPersonas: Array<Persona> = [];

		for (let i = 0; i < total; i++) {
			const member = members[i];
			const displayName =
				member.display_name && member.display_name.trim().length > 0
					? member.display_name.trim()
					: member.name && member.name.trim().length > 0
						? member.name.trim()
						: '';

			const primaryPrefix = member.proxy_tags?.[0]?.prefix?.trim() || '(none)';

			if (!displayName) {
				warnings.push({
					displayName: member.id ? `Member [${member.id}]` : '(Unnamed entry)',
					prefix: primaryPrefix,
					reason: 'Skipped: Entry has neither display name nor name.',
				});
				setProgress({
					current: i + 1,
					total,
					currentName: '(Skipped entry)',
					percent: Math.round(((i + 1) / total) * 100),
				});
				continue;
			}

			setProgress({
				current: i + 1,
				total,
				currentName: displayName,
				percent: Math.round(((i + 1) / total) * 100),
			});

			const remoteAvatarUrl = member.avatar_url || member.webhook_avatar_url || null;
			let localAvatarUrl: string | undefined;

			if (remoteAvatarUrl) {
				try {
					const res = await http.post<{avatar_url: string; message?: string}>(Endpoints.USER_SUBPROFILE_IMPORT_AVATAR, {
						body: {url: remoteAvatarUrl},
					});
					if (res.ok && res.body?.avatar_url) {
						localAvatarUrl = res.body.avatar_url;
					} else {
						const failureReason =
							res.body?.message || (res.status === 404 ? 'HTTP 404 Not Found' : `HTTP ${res.status || 'Failed'}`);
						warnings.push({
							displayName,
							prefix: primaryPrefix,
							reason: `Avatar image failed to download: ${failureReason}. Subprofile was imported without an avatar.`,
						});
					}
				} catch (err: unknown) {
					const errorMsg = err instanceof Error ? err.message : 'Network error';
					warnings.push({
						displayName,
						prefix: primaryPrefix,
						reason: `Avatar download failed: ${errorMsg}. Subprofile was imported without an avatar.`,
					});
				}
			}

			let colorInt: number | undefined;
			if (member.color) {
				const cleaned = member.color.replace('#', '').trim();
				const parsedColor = parseInt(cleaned, 16);
				if (!Number.isNaN(parsedColor)) {
					colorInt = parsedColor;
				}
			}

			const proxyTags = (member.proxy_tags ?? [])
				.filter((t) => t.prefix?.trim() || t.suffix?.trim())
				.map((t) => ({
					$typeName: 'fluxer.user.preferences.v1.ProxyTag' as const,
					prefix: t.prefix?.trim() || undefined,
					suffix: t.suffix?.trim() || undefined,
				}));

			const id = `${SnowflakeUtils.fromTimestamp(Date.now())}_${++importIdCounter}`;
			const persona: Persona = {
				$typeName: 'fluxer.user.preferences.v1.Persona',
				id,
				name: displayName,
				avatarUrl: localAvatarUrl,
				systemName: systemTagOverride.trim() || undefined,
				pronouns: member.pronouns?.trim() || undefined,
				color: colorInt,
				bio: member.description?.trim() || undefined,
				autoProxyDisabled: false,
				useCount: 0,
				lastUsedAtMs: 0n,
				proxyTags,
			};

			importedPersonas.push(persona);
		}

		if (importMode === 'replace') {
			await SubprofileStore.replaceAllPersonas(importedPersonas);
		} else {
			await SubprofileStore.appendPersonas(importedPersonas);
		}

		setImportResults({
			successCount: importedPersonas.length,
			warnings,
		});
		setStep('completed');
	};

	const modalTitle =
		step === 'select' ? 'Import from PluralKit' : step === 'importing' ? 'Importing Subprofiles...' : 'Import Complete';

	return (
		<Modal.Root size="medium" onClose={step === 'importing' ? () => {} : onClose}>
			<Modal.Header title={modalTitle} hideCloseButton={step === 'importing'} />

			<Modal.Content>
				<div className={styles.container}>
					{/* STEP 1: SELECT & CONFIGURE */}
					{step === 'select' && (
						<>
							<div
								className={styles.dropzone}
								role="button"
								tabIndex={0}
								onDrop={handleDrop}
								onDragOver={handleDragOver}
								onClick={() => fileInputRef.current?.click()}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										fileInputRef.current?.click();
									}
								}}
							>
								<UploadSimple size={36} style={{color: 'var(--brand-experiment)'}} />
								<div className={styles.dropzoneText}>
									{fileName ? fileName : 'Choose a PluralKit export (.json) or drag & drop'}
								</div>
								<div className={styles.dropzoneSubtext}>Supports PluralKit system export files</div>
								<input
									ref={fileInputRef}
									type="file"
									accept=".json,application/json"
									className={styles.hiddenFileInput}
									onChange={(e) => {
										if (e.target.files && e.target.files.length > 0) {
											handleFileChosen(e.target.files[0]);
										}
									}}
								/>
							</div>

							{fileError && <div className={styles.errorBanner}>{fileError}</div>}

							{pkData && (
								<>
									<div className={styles.summaryBox}>
										<div className={styles.summaryTitle}>Export Summary</div>
										<div className={styles.summaryRow}>
											<span className={styles.summaryLabel}>Detected System Name / Tag</span>
											<span className={styles.summaryValue}>
												{pkData.name || 'None'} {pkData.tag ? `(${pkData.tag})` : ''}
											</span>
										</div>
										<div className={styles.summaryRow}>
											<span className={styles.summaryLabel}>Total Members</span>
											<span className={styles.summaryValue}>{pkData.members?.length ?? 0}</span>
										</div>
										<div className={styles.summaryRow}>
											<span className={styles.summaryLabel}>Members with Avatars</span>
											<span className={styles.summaryValue}>
												{pkData.members?.filter((m) => Boolean(m.avatar_url || m.webhook_avatar_url)).length ?? 0}
											</span>
										</div>
									</div>

									<div className={styles.formField}>
										<div className={styles.formLabel}>System Tag (Applied to imported personas)</div>
										<input
											type="text"
											className={styles.textInput}
											value={systemTagOverride}
											onChange={(e) => setSystemTagOverride(e.target.value)}
											placeholder="Optional system badge, e.g. ⚞Seraphim⚟"
											maxLength={100}
										/>
									</div>

									{existingCount > 0 && (
										<div className={styles.formField}>
											<div className={styles.formLabel}>Import Strategy</div>
											<div className={styles.optionsGroup}>
												<label
													className={clsx(styles.radioOption, importMode === 'replace' && styles.radioOptionSelected)}
												>
													<input
														type="radio"
														name="importMode"
														checked={importMode === 'replace'}
														onChange={() => setImportMode('replace')}
														style={{marginTop: 3}}
													/>
													<div>
														<div className={styles.radioTitle}>Replace all existing subprofiles</div>
														<div className={styles.radioDesc}>
															Erase all {existingCount} existing subprofile(s) and replace them completely with the
															imported profiles.
														</div>
													</div>
												</label>
												<label
													className={clsx(styles.radioOption, importMode === 'append' && styles.radioOptionSelected)}
												>
													<input
														type="radio"
														name="importMode"
														checked={importMode === 'append'}
														onChange={() => setImportMode('append')}
														style={{marginTop: 3}}
													/>
													<div>
														<div className={styles.radioTitle}>Keep existing and add new</div>
														<div className={styles.radioDesc}>
															Keep your {existingCount} current subprofile(s) and add all {pkData.members?.length ?? 0}{' '}
															imported profiles alongside them as new entries.
														</div>
													</div>
												</label>
											</div>
										</div>
									)}
								</>
							)}
						</>
					)}

					{/* STEP 2: IMPORTING PROGRESS */}
					{step === 'importing' && (
						<div style={{padding: '16px 0'}}>
							<div className={styles.progressCurrentName}>Processing: {progress.currentName}</div>
							<div className={styles.progressBarContainer}>
								<div className={styles.progressBarFill} style={{width: `${progress.percent}%`}} />
							</div>
							<div className={styles.progressDetail}>
								{progress.current} of {progress.total} members ({progress.percent}%) &bull; Downloading avatars to local
								S3
							</div>
						</div>
					)}

					{/* STEP 3: COMPLETED & WARNINGS */}
					{step === 'completed' && (
						<>
							<div className={styles.successBox}>
								<CheckCircle size={36} style={{color: 'var(--status-positive)', marginBottom: 8}} />
								<div className={styles.successTitle}>Import Complete!</div>
								<div className={styles.successDesc}>
									Successfully imported {importResults.successCount} subprofile(s) into your account. All avatar images
									are safely stored on your local server.
								</div>
							</div>

							{importResults.warnings.length > 0 && (
								<div className={styles.warningBox}>
									<div className={styles.warningHeader}>
										<Warning size={18} />
										<span>
											{importResults.warnings.length} notice
											{importResults.warnings.length > 1 ? 's' : ''} during import
										</span>
									</div>
									<div className={styles.warningList}>
										{importResults.warnings.map((w, idx) => (
											<div key={idx} className={styles.warningItem}>
												<div className={styles.warningItemName}>
													{w.displayName}{' '}
													<span style={{fontWeight: 400, color: 'var(--text-muted)'}}>(Prefix: {w.prefix})</span>
												</div>
												<div className={styles.warningItemDetail}>{w.reason}</div>
											</div>
										))}
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</Modal.Content>

			<Modal.Footer>
				{step === 'select' && (
					<>
						<Button variant="secondary" onClick={onClose}>
							Cancel
						</Button>
						<Button
							variant="primary"
							disabled={!pkData || !pkData.members || pkData.members.length === 0}
							onClick={handleStartImport}
						>
							Start Import
						</Button>
					</>
				)}

				{step === 'importing' && (
					<Button variant="secondary" disabled>
						Importing...
					</Button>
				)}

				{step === 'completed' && (
					<Button variant="primary" onClick={onClose}>
						Done
					</Button>
				)}
			</Modal.Footer>
		</Modal.Root>
	);
});

PluralKitImportModal.displayName = 'PluralKitImportModal';

export function openPluralKitImportModal(): void {
	ModalCommands.push(ModalCommands.modal(() => <PluralKitImportModal onClose={() => ModalCommands.pop()} />));
}
