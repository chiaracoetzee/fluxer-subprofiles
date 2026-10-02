// SPDX-License-Identifier: AGPL-3.0-or-later

import {spawn} from 'node:child_process';
import {existsSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {app} from 'electron';
import log from 'electron-log';

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
 * Applies a Windows NSIS update by spawning a detached PowerShell process that:
 * 1. Waits for the current Electron process to exit
 * 2. Runs Setup.exe silently with /S and waits for completion
 * 3. Relaunches the updated application
 * 4. Cleans up staging directory and the script
 *
 * Comprehensive progress, exit codes, and errors are written to both temp and app log files.
 */
export function applyWindowsNsisUpdate(
	setupExePath: string,
	stagingDirectory: string,
	currentExePath: string = process.execPath,
): void {
	const targetPid = process.pid;
	const {tempLogPath, appLogPath} = getUpdateLogPaths();

	// Write a PowerShell script to temp so we can run it completely detached and hidden
	const scriptPath = join(tmpdir(), `fluxer-update-${Date.now()}.ps1`);
	const script = [
		'$ErrorActionPreference = "Continue"',
		`$targetPid = ${targetPid}`,
		`$setupExe = "${setupExePath.replace(/\\/g, '\\\\')}"`,
		`$currentExe = "${currentExePath.replace(/\\/g, '\\\\')}"`,
		`$staging = "${stagingDirectory.replace(/\\/g, '\\\\')}"`,
		`$script = "${scriptPath.replace(/\\/g, '\\\\')}"`,
		`$tempLogPath = "${tempLogPath.replace(/\\/g, '\\\\')}"`,
		`$appLogPath = "${appLogPath.replace(/\\/g, '\\\\')}"`,
		'',
		'function Write-UpdateLog([string]$msg) {',
		'    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")',
		'    $line = "[$ts] $msg"',
		'    if ($tempLogPath) {',
		'        Add-Content -LiteralPath $tempLogPath -Value $line -ErrorAction SilentlyContinue',
		'    }',
		'    if ($appLogPath) {',
		'        Add-Content -LiteralPath $appLogPath -Value $line -ErrorAction SilentlyContinue',
		'    }',
		'}',
		'',
		'try {',
		'    # Ensure log directories exist',
		'    $tempDir = Split-Path -Parent $tempLogPath',
		'    if ($tempDir -and (-not (Test-Path -LiteralPath $tempDir))) {',
		'        New-Item -ItemType Directory -LiteralPath $tempDir -Force -ErrorAction SilentlyContinue | Out-Null',
		'    }',
		'    if ($appLogPath) {',
		'        $appDir = Split-Path -Parent $appLogPath',
		'        if ($appDir -and (-not (Test-Path -LiteralPath $appDir))) {',
		'            New-Item -ItemType Directory -LiteralPath $appDir -Force -ErrorAction SilentlyContinue | Out-Null',
		'        }',
		'    }',
		'',
		'    Write-UpdateLog "=========================================="',
		'    Write-UpdateLog "Fluxer Windows NSIS Update Helper started"',
		'    Write-UpdateLog "Target PID: $targetPid"',
		'    Write-UpdateLog "Setup Executable: $setupExe"',
		'    Write-UpdateLog "Current Executable: $currentExe"',
		'    Write-UpdateLog "Staging Directory: $staging"',
		'    Write-UpdateLog "Script Path: $script"',
		'    Write-UpdateLog "PowerShell Version: $($PSVersionTable.PSVersion)"',
		'',
		'    # Verify Setup Exe exists before proceeding',
		'    if (-not (Test-Path -LiteralPath $setupExe)) {',
		'        Write-UpdateLog "ERROR: Setup executable not found at $setupExe"',
		'        exit 1',
		'    }',
		'    $setupItem = Get-Item -LiteralPath $setupExe -ErrorAction SilentlyContinue',
		'    Write-UpdateLog "Setup executable verified on disk ($($setupItem.Length) bytes)"',
		'',
		'    # Wait for the Electron process to exit (up to 60 seconds)',
		'    Write-UpdateLog "Waiting for parent process $targetPid to exit (timeout: 60s)..."',
		'    Wait-Process -Id $targetPid -Timeout 60 -ErrorAction SilentlyContinue',
		'',
		'    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue',
		'    if ($proc) {',
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
		'    # Run NSIS installer silently and wait for it to complete',
		'    Write-UpdateLog "Launching NSIS installer silently: $setupExe /S"',
		'    $installerProc = Start-Process -FilePath $setupExe -ArgumentList "/S" -Wait -PassThru',
		'    Write-UpdateLog "NSIS installer completed with ExitCode: $($installerProc.ExitCode)"',
		'    if ($installerProc.ExitCode -ne 0) {',
		'        Write-UpdateLog "WARNING: NSIS installer returned non-zero ExitCode $($installerProc.ExitCode)"',
		'    }',
		'',
		'    # Grace period after installer finishes',
		'    Start-Sleep -Seconds 1',
		'',
		'    # Relaunch the application',
		'    Write-UpdateLog "Checking application executable at: $currentExe"',
		'    if (Test-Path -LiteralPath $currentExe) {',
		'        Write-UpdateLog "Relaunching application: $currentExe"',
		'        $relaunched = Start-Process -FilePath $currentExe -PassThru',
		'        Write-UpdateLog "Application successfully relaunched with PID: $($relaunched.Id)"',
		'    } else {',
		'        Write-UpdateLog "ERROR: Application executable not found at: $currentExe"',
		'    }',
		'',
		'    # Clean up staging directory',
		'    Write-UpdateLog "Cleaning up staging directory: $staging"',
		'    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue',
		'    Write-UpdateLog "Fluxer update helper completed successfully."',
		'} catch {',
		'    Write-UpdateLog "CRITICAL ERROR in update helper script: $($_.Exception.ToString())"',
		'} finally {',
		'    Remove-Item -LiteralPath $script -Force -ErrorAction SilentlyContinue',
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

	log.info('Windows NSIS update helper launched', {
		setupExePath,
		currentExePath,
		scriptPath,
		tempLogPath,
		appLogPath,
		helperPid: child.pid,
		parentPid: targetPid,
	});
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
		'$ErrorActionPreference = "Continue"',
		`$targetPid = ${targetPid}`,
		`$newExe = "${newExePath.replace(/\\/g, '\\\\')}"`,
		`$currentExe = "${currentExePath.replace(/\\/g, '\\\\')}"`,
		`$oldExe = "${oldExePath.replace(/\\/g, '\\\\')}"`,
		`$staging = "${stagingDirectory.replace(/\\/g, '\\\\')}"`,
		`$script = "${scriptPath.replace(/\\/g, '\\\\')}"`,
		`$tempLogPath = "${tempLogPath.replace(/\\/g, '\\\\')}"`,
		`$appLogPath = "${appLogPath.replace(/\\/g, '\\\\')}"`,
		'',
		'function Write-UpdateLog([string]$msg) {',
		'    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")',
		'    $line = "[$ts] $msg"',
		'    if ($tempLogPath) {',
		'        Add-Content -LiteralPath $tempLogPath -Value $line -ErrorAction SilentlyContinue',
		'    }',
		'    if ($appLogPath) {',
		'        Add-Content -LiteralPath $appLogPath -Value $line -ErrorAction SilentlyContinue',
		'    }',
		'}',
		'',
		'try {',
		'    # Ensure log directories exist',
		'    $tempDir = Split-Path -Parent $tempLogPath',
		'    if ($tempDir -and (-not (Test-Path -LiteralPath $tempDir))) {',
		'        New-Item -ItemType Directory -LiteralPath $tempDir -Force -ErrorAction SilentlyContinue | Out-Null',
		'    }',
		'    if ($appLogPath) {',
		'        $appDir = Split-Path -Parent $appLogPath',
		'        if ($appDir -and (-not (Test-Path -LiteralPath $appDir))) {',
		'            New-Item -ItemType Directory -LiteralPath $appDir -Force -ErrorAction SilentlyContinue | Out-Null',
		'        }',
		'    }',
		'',
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
		'    if (-not (Test-Path -LiteralPath $newExe)) {',
		'        Write-UpdateLog "ERROR: New executable not found at: $newExe"',
		'        exit 1',
		'    }',
		'    $newExeItem = Get-Item -LiteralPath $newExe -ErrorAction SilentlyContinue',
		'    Write-UpdateLog "New executable verified on disk ($($newExeItem.Length) bytes)"',
		'',
		'    # Wait for the Electron process to exit (up to 60 seconds)',
		'    Write-UpdateLog "Waiting for parent process $targetPid to exit (timeout: 60s)..."',
		'    Wait-Process -Id $targetPid -Timeout 60 -ErrorAction SilentlyContinue',
		'',
		'    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue',
		'    if ($proc) {',
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
		'    if (Test-Path -LiteralPath $currentExe) {',
		'        if (Test-Path -LiteralPath $oldExe) {',
		'            Write-UpdateLog "Removing previous backup at: $oldExe"',
		'            Remove-Item -LiteralPath $oldExe -Force -ErrorAction SilentlyContinue',
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
		'        if (Test-Path -LiteralPath $oldExe) {',
		'            Write-UpdateLog "Attempting rollback from backup $oldExe..."',
		'            Rename-Item -LiteralPath $oldExe -NewName ([System.IO.Path]::GetFileName($currentExe)) -Force',
		'        }',
		'    }',
		'',
		'    # Relaunch the application',
		'    if (Test-Path -LiteralPath $currentExe) {',
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
		'    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue',
		'    Remove-Item -LiteralPath $oldExe -Force -ErrorAction SilentlyContinue',
		'    Write-UpdateLog "Fluxer portable update helper completed successfully."',
		'} catch {',
		'    Write-UpdateLog "CRITICAL ERROR in update helper script: $($_.Exception.ToString())"',
		'} finally {',
		'    Remove-Item -LiteralPath $script -Force -ErrorAction SilentlyContinue',
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
