// SPDX-License-Identifier: AGPL-3.0-or-later

import {spawn} from 'node:child_process';
import {existsSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {app} from 'electron';
import log from 'electron-log';

/**
 * Formats a string as a PowerShell single-quoted literal string.
 * In PowerShell, single-quoted strings ('...') are verbatim string literals:
 * backslashes are NOT escape characters, variables are NOT expanded,
 * and single quotes are escaped by doubling them ('').
 */
function toPowerShellLiteralString(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Returns paths where update helper logs should be written.
 * - tempLogPath: in %TEMP%\fluxer-update.log (always writable)
 * - appLogPath: in the user's AppData\Roaming\fluxer\logs\update-helper.log (next to main.log)
 */
export function getUpdateLogPaths(): {tempLogPath: string; appLogPath: string} {
	const tempLogPath = join(tmpdir(), 'fluxer-update.log');
	let appLogPath = '';
	try {
		appLogPath = join(app.getPath('userData'), 'logs', 'update-helper.log');
	} catch {
		if (process.env.APPDATA) {
			appLogPath = join(process.env.APPDATA, 'fluxer', 'logs', 'update-helper.log');
		}
	}
	return {tempLogPath, appLogPath};
}

/**
 * Applies a Windows NSIS update by launching the oneClick installer directly.
 *
 * The electron-builder oneClick NSIS installer (with runAfterFinish: true, the default)
 * handles everything itself:
 * - Shows a native progress bar UI (no prompts since oneClick: true)
 * - Detects and closes the running application
 * - Replaces files in place
 * - Relaunches the updated application
 * - Cleans up after itself
 *
 * The installer is a native Win32 executable, so it has no issues with Node's
 * DETACHED_PROCESS flag (unlike PowerShell which requires a console handle).
 */
export function applyWindowsNsisUpdate(
	setupExePath: string,
	_stagingDirectory: string,
	_currentExePath: string = process.execPath,
): void {
	log.info('Launching NSIS oneClick installer for update', {
		setupExePath,
		pid: process.pid,
	});

	const child = spawn(setupExePath, ['--force-run'], {
		detached: true,
		stdio: 'ignore',
	});
	child.unref();

	log.info('NSIS installer spawned', {helperPid: child.pid});
}

/**
 * Applies a Windows portable update by spawning a detached PowerShell process that:
 * 1. Waits for the current Electron process to exit
 * 2. Renames the old exe to .old (rollback safety)
 * 3. Moves the new exe into place
 * 4. Relaunches the app
 * 5. Cleans up the .old file and staging directory
 *
 * Comprehensive progress, exit codes, and errors are written to both temp and app log files.
 */
export function applyWindowsPortableUpdate(
	newExePath: string,
	currentExePath: string,
	stagingDirectory: string,
): void {
	const targetPid = process.pid;
	const oldExePath = currentExePath.replace(/\.exe$/i, '.old.exe');
	const {tempLogPath, appLogPath} = getUpdateLogPaths();

	// PowerShell script embedded as a string, written to temp
	const scriptPath = join(tmpdir(), `fluxer-update-${Date.now()}.ps1`);
	const script = [
		'Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force -ErrorAction SilentlyContinue',
		'$ErrorActionPreference = "Continue"',
		`$targetPid = ${targetPid}`,
		`$newExe = ${toPowerShellLiteralString(newExePath)}`,
		`$currentExe = ${toPowerShellLiteralString(currentExePath)}`,
		`$oldExe = ${toPowerShellLiteralString(oldExePath)}`,
		`$staging = ${toPowerShellLiteralString(stagingDirectory)}`,
		`$script = ${toPowerShellLiteralString(scriptPath)}`,
		`$tempLogPath = ${toPowerShellLiteralString(tempLogPath)}`,
		`$appLogPath = ${toPowerShellLiteralString(appLogPath)}`,
		'',
		'function Write-UpdateLog([string]$msg) {',
		'    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")',
		'    $line = "[$ts] $msg"',
		'    try {',
		'        if ($tempLogPath) {',
		'            $dir = [System.IO.Path]::GetDirectoryName($tempLogPath)',
		'            if ($dir -and -not [System.IO.Directory]::Exists($dir)) {',
		'                [System.IO.Directory]::CreateDirectory($dir) | Out-Null',
		'            }',
		'            [System.IO.File]::AppendAllText($tempLogPath, $line + "`r`n", [System.Text.Encoding]::UTF8)',
		'        }',
		'    } catch {}',
		'    try {',
		'        if ($appLogPath) {',
		'            $dir = [System.IO.Path]::GetDirectoryName($appLogPath)',
		'            if ($dir -and -not [System.IO.Directory]::Exists($dir)) {',
		'                [System.IO.Directory]::CreateDirectory($dir) | Out-Null',
		'            }',
		'            [System.IO.File]::AppendAllText($appLogPath, $line + "`r`n", [System.Text.Encoding]::UTF8)',
		'        }',
		'    } catch {}',
		'}',
		'',
		'try {',
		'    Write-UpdateLog "=========================================="',
		'    Write-UpdateLog "Fluxer Windows Portable Update Helper started"',
		'    Write-UpdateLog "Target PID: $targetPid"',
		'    Write-UpdateLog "New Exe: $newExe"',
		'    Write-UpdateLog "Current Exe: $currentExe"',
		'    Write-UpdateLog "Backup Exe: $oldExe"',
		'    Write-UpdateLog "Staging Dir: $staging"',
		'    Write-UpdateLog "Script Path: $script"',
		'    Write-UpdateLog "PowerShell Version: $($PSVersionTable.PSVersion)"',
		'',
		'    # Verify new executable exists',
		'    if (-not [System.IO.File]::Exists($newExe)) {',
		'        Write-UpdateLog "ERROR: New executable not found at: $newExe"',
		'        exit 1',
		'    }',
		'    $newExeItem = Get-Item -LiteralPath $newExe -ErrorAction SilentlyContinue',
		'    if ($newExeItem) {',
		'        Write-UpdateLog "New executable verified on disk ($($newExeItem.Length) bytes)"',
		'    }',
		'',
		'    # Wait for the Electron process to exit (up to 60 seconds)',
		'    Write-UpdateLog "Waiting for parent process $targetPid to exit (timeout: 60s)..."',
		'    $waited = 0',
		'    while ($waited -lt 60) {',
		'        $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue',
		'        if (-not $proc) { break }',
		'        Start-Sleep -Seconds 1',
		'        $waited++',
		'    }',
		'    if ($waited -ge 60) {',
		'        Write-UpdateLog "WARNING: Process $targetPid did not exit within 60s; terminating it..."',
		'        Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue',
		'        Start-Sleep -Seconds 1',
		'    } else {',
		'        Write-UpdateLog "Parent process $targetPid exited cleanly."',
		'    }',
		'',
		'    # Grace period for file locks to release',
		'    Start-Sleep -Seconds 1',
		'',
		'    # Rename current exe to .old for rollback safety',
		'    if ([System.IO.File]::Exists($currentExe)) {',
		'        if ([System.IO.File]::Exists($oldExe)) {',
		'            Write-UpdateLog "Removing previous backup at: $oldExe"',
		'            try { [System.IO.File]::Delete($oldExe) } catch {}',
		'        }',
		'        Write-UpdateLog "Backing up current executable: $currentExe -> $oldExe"',
		'        Rename-Item -LiteralPath $currentExe -NewName ([System.IO.Path]::GetFileName($oldExe)) -Force',
		'    }',
		'',
		'    # Move new exe into place with fallback to old exe if it fails',
		'    try {',
		'        Write-UpdateLog "Moving new executable into place: $newExe -> $currentExe"',
		'        Move-Item -LiteralPath $newExe -Destination $currentExe -Force',
		'        Write-UpdateLog "New executable successfully moved into place."',
		'    } catch {',
		'        Write-UpdateLog "ERROR: Failed to move new executable: $($_.Exception.Message)"',
		'        if ([System.IO.File]::Exists($oldExe)) {',
		'            Write-UpdateLog "Attempting rollback from backup $oldExe..."',
		'            Rename-Item -LiteralPath $oldExe -NewName ([System.IO.Path]::GetFileName($currentExe)) -Force',
		'        }',
		'    }',
		'',
		'    # Relaunch the application',
		'    if ([System.IO.File]::Exists($currentExe)) {',
		'        Write-UpdateLog "Relaunching application: $currentExe"',
		'        $relaunched = Start-Process -FilePath $currentExe -PassThru',
		'        Write-UpdateLog "Application successfully relaunched with PID: $($relaunched.Id)"',
		'    } else {',
		'        Write-UpdateLog "ERROR: Application executable not found at: $currentExe"',
		'    }',
		'',
		'    # Clean up staging and old executable',
		'    Start-Sleep -Seconds 2',
		'    Write-UpdateLog "Cleaning up staging directory: $staging"',
		'    try {',
		'        if ([System.IO.Directory]::Exists($staging)) {',
		'            [System.IO.Directory]::Delete($staging, $true)',
		'        }',
		'    } catch {}',
		'    try {',
		'        if ([System.IO.File]::Exists($oldExe)) {',
		'            [System.IO.File]::Delete($oldExe)',
		'        }',
		'    } catch {}',
		'    Write-UpdateLog "Fluxer portable update helper completed successfully."',
		'} catch {',
		'    Write-UpdateLog "CRITICAL ERROR in update helper script: $($_.Exception.ToString())"',
		'} finally {',
		'    try {',
		'        if ([System.IO.File]::Exists($script)) {',
		'            [System.IO.File]::Delete($script)',
		'        }',
		'    } catch {}',
		'}',
	].join('\r\n');

	writeFileSync(scriptPath, script, 'utf8');

	const child = spawn(
		'powershell.exe',
		['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
		{
			detached: true,
			stdio: 'ignore',
			windowsHide: true,
		},
	);
	child.unref();

	log.info('Windows portable update helper launched', {
		newExePath,
		currentExePath,
		scriptPath,
		tempLogPath,
		appLogPath,
		helperPid: child.pid,
		parentPid: targetPid,
	});
}

/**
 * Determines if the current Windows installation is NSIS-installed (as opposed to portable).
 * NSIS installs to %LocalAppData%\Fluxer\ or %LocalAppData%\FluxerCanary\.
 * Portable builds set PORTABLE_EXECUTABLE_DIR or have a .portable marker.
 */
export function isWindowsNsisInstalled(): boolean {
	if (process.platform !== 'win32') return false;

	// If portable mode is detected, it's NOT an NSIS install
	if (process.env.PORTABLE_EXECUTABLE_DIR) return false;

	// Check for .portable marker next to the exe
	const exeDir = dirname(process.execPath);
	if (existsSync(join(exeDir, '.portable'))) return false;

	// Check if running from a typical NSIS install location (%LocalAppData%)
	const localAppData = process.env.LOCALAPPDATA;
	if (localAppData && process.execPath.toLowerCase().startsWith(localAppData.toLowerCase())) {
		return true;
	}

	// Check for Uninstall registry breadcrumb (NSIS creates an uninstaller)
	const uninstallerPath = join(exeDir, 'Uninstall Fluxer.exe');
	const uninstallerPathCanary = join(exeDir, 'Uninstall Fluxer-Canary.exe');
	if (existsSync(uninstallerPath) || existsSync(uninstallerPathCanary)) {
		return true;
	}

	// Default: not NSIS (could be a zip extraction or dev build)
	return false;
}
