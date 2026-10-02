// SPDX-License-Identifier: AGPL-3.0-or-later

import {spawn} from 'node:child_process';
import {existsSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import log from 'electron-log';

/**
 * Applies a Windows NSIS update by spawning a detached cmd.exe process that:
 * 1. Waits for the current Electron process to exit
 * 2. Runs the Setup.exe with /S (silent install)
 * 3. Cleans up the staging directory
 *
 * NSIS /S handles killing any remaining processes, replacing files, and relaunching.
 */
export function applyWindowsNsisUpdate(setupExePath: string, stagingDirectory: string): void {
	const pid = process.pid;

	// Write a batch script to temp so we can run it detached
	const scriptPath = join(tmpdir(), `fluxer-update-${Date.now()}.cmd`);
	const script = [
		'@echo off',
		// Wait for the Electron process to exit (up to 30 seconds)
		`:wait`,
		`tasklist /FI "PID eq ${pid}" 2>NUL | find /I "${pid}" >NUL`,
		`if %ERRORLEVEL% EQU 0 (`,
		`    timeout /T 1 /NOBREAK >NUL`,
		`    goto wait`,
		`)`,
		// Small grace period after process exit
		`timeout /T 2 /NOBREAK >NUL`,
		// Run NSIS installer silently
		`"${setupExePath}" /S`,
		// Clean up staging directory and this script
		`rmdir /S /Q "${stagingDirectory}" 2>NUL`,
		`del /F /Q "${scriptPath}" 2>NUL`,
	].join('\r\n');

	writeFileSync(scriptPath, script, 'utf8');

	const child = spawn('cmd.exe', ['/c', scriptPath], {
		detached: true,
		stdio: 'ignore',
		windowsHide: true,
	});
	child.unref();

	log.info('Windows NSIS update helper launched', {
		setupExePath,
		scriptPath,
		helperPid: child.pid,
		parentPid: pid,
	});
}

/**
 * Applies a Windows portable update by spawning a detached PowerShell process that:
 * 1. Waits for the current Electron process to exit
 * 2. Renames the old exe to .old (rollback safety)
 * 3. Moves the new exe into place
 * 4. Relaunches the app
 * 5. Cleans up the .old file and staging directory
 */
export function applyWindowsPortableUpdate(
	newExePath: string,
	currentExePath: string,
	stagingDirectory: string,
): void {
	const pid = process.pid;

	// PowerShell script embedded as a string, written to temp
	const scriptPath = join(tmpdir(), `fluxer-update-${Date.now()}.ps1`);
	const script = [
		'$ErrorActionPreference = "Stop"',
		`$pid = ${pid}`,
		`$newExe = "${newExePath.replace(/\\/g, '\\\\')}"`,
		`$currentExe = "${currentExePath.replace(/\\/g, '\\\\')}"`,
		`$oldExe = "${currentExePath.replace(/\\/g, '\\\\')}".Replace(".exe", ".old.exe")`,
		`$staging = "${stagingDirectory.replace(/\\/g, '\\\\')}"`,
		`$script = "${scriptPath.replace(/\\/g, '\\\\')}"`,
		'',
		'# Wait for Electron process to exit (up to 60 seconds)',
		'$waited = 0',
		'while ($waited -lt 300) {',
		'    try {',
		'        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue',
		'        if ($null -eq $proc) { break }',
		'    } catch { break }',
		'    Start-Sleep -Milliseconds 200',
		'    $waited++',
		'}',
		'',
		'# Grace period',
		'Start-Sleep -Seconds 1',
		'',
		'# Rename current exe to .old for rollback safety',
		'if (Test-Path $currentExe) {',
		'    if (Test-Path $oldExe) { Remove-Item -Force $oldExe }',
		'    Rename-Item -Path $currentExe -NewName ([System.IO.Path]::GetFileName($oldExe)) -Force',
		'}',
		'',
		'# Move new exe into place',
		'Move-Item -Path $newExe -Destination $currentExe -Force',
		'',
		'# Relaunch',
		'Start-Process $currentExe',
		'',
		'# Clean up',
		'Start-Sleep -Seconds 2',
		'Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue',
		'Remove-Item -Force $oldExe -ErrorAction SilentlyContinue',
		'Remove-Item -Force $script -ErrorAction SilentlyContinue',
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
		helperPid: child.pid,
		parentPid: pid,
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
	const exeDir = require('node:path').dirname(process.execPath);
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
