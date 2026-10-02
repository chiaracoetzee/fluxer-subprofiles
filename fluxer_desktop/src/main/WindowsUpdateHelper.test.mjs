// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {describe, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

const sourcePath = fileURLToPath(new URL('./WindowsUpdateHelper.ts', import.meta.url));
const source = readFileSync(sourcePath, 'utf8');
const transformedSource = esbuild.transformSync(source, {
	loader: 'ts',
	format: 'cjs',
	platform: 'node',
	target: 'node20',
}).code;

function loadHelper(overrides = {}) {
	const writtenFiles = new Map();
	const spawnedProcesses = [];
	const logs = [];

	const fakeFs = {
		existsSync: (p) => overrides.existingFiles?.has(p) ?? false,
		writeFileSync: (p, content) => {
			writtenFiles.set(p, content);
		},
	};

	const fakeChildProcess = {
		spawn: (cmd, args, opts) => {
			const child = {
				pid: 9999,
				unref: () => {},
			};
			spawnedProcesses.push({cmd, args, opts, child});
			return child;
		},
	};

	const module = {exports: {}};
	const context = vm.createContext({
		module,
		exports: module.exports,
		process: {
			pid: 1234,
			platform: 'win32',
			execPath: 'C:\\Users\\test\\AppData\\Local\\Programs\\fluxer_desktop\\Fluxer.exe',
			env: {
				APPDATA: 'C:\\Users\\test\\AppData\\Roaming',
				LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local',
				...overrides.env,
			},
		},
		console,
		Date,
		require: (specifier) => {
			if (specifier === 'node:fs') return fakeFs;
			if (specifier === 'node:child_process') return fakeChildProcess;
			if (specifier === 'node:os') return {tmpdir: () => 'C:\\Users\\test\\AppData\\Local\\Temp'};
			if (specifier === 'node:path') return path.win32;
			if (specifier === 'electron') {
				return {
					app: {
						getPath: (name) => {
							if (name === 'userData') return 'C:\\Users\\test\\AppData\\Roaming\\fluxer';
							return 'C:\\Users\\test';
						},
					},
				};
			}
			if (specifier === 'electron-log') {
				return {info: (...args) => logs.push(args), warn: () => {}, error: () => {}};
			}
			throw new Error(`Unexpected require: ${specifier}`);
		},
	});

	vm.runInContext(transformedSource, context);
	return {
		exports: module.exports,
		writtenFiles,
		spawnedProcesses,
		logs,
	};
}

describe('WindowsUpdateHelper', () => {
	test('getUpdateLogPaths returns expected paths in temp and appData', () => {
		const {exports} = loadHelper();
		const paths = exports.getUpdateLogPaths();
		assert.equal(paths.tempLogPath, 'C:\\Users\\test\\AppData\\Local\\Temp\\fluxer-update.log');
		assert.equal(paths.appLogPath, 'C:\\Users\\test\\AppData\\Roaming\\fluxer\\logs\\update-helper.log');
	});

	test('applyWindowsNsisUpdate spawns the NSIS installer directly with --force-run', () => {
		const {exports, writtenFiles, spawnedProcesses} = loadHelper();
		const setupExe = 'C:\\Users\\test\\AppData\\Local\\Temp\\fluxer-update-123\\Fluxer-Setup-1.2.4-win-x64.exe';
		const stagingDir = 'C:\\Users\\test\\AppData\\Local\\Temp\\fluxer-update-123';
		const currentExe = 'C:\\Users\\test\\AppData\\Local\\Programs\\fluxer_desktop\\Fluxer.exe';

		exports.applyWindowsNsisUpdate(setupExe, stagingDir, currentExe);

		// Must NOT write any script files — the installer handles everything
		assert.equal(writtenFiles.size, 0);

		// Must spawn the installer exe directly
		assert.equal(spawnedProcesses.length, 1);
		const spawnCall = spawnedProcesses[0];
		assert.equal(spawnCall.cmd, setupExe);
		assert.equal(spawnCall.args.length, 1);
		assert.equal(spawnCall.args[0], '--force-run');
		assert.equal(spawnCall.opts.detached, true);
	});

	test('applyWindowsPortableUpdate writes a PowerShell script with single-quoted paths and rollback safety', () => {
		const {exports, writtenFiles, spawnedProcesses} = loadHelper();
		const newExe = 'C:\\Users\\test\\AppData\\Local\\Temp\\fluxer-update-123\\Fluxer.exe';
		const stagingDir = 'C:\\Users\\test\\AppData\\Local\\Temp\\fluxer-update-123';
		const currentExe = 'C:\\Users\\test\\AppData\\Local\\Programs\\fluxer_desktop\\Fluxer.exe';

		exports.applyWindowsPortableUpdate(newExe, currentExe, stagingDir);

		assert.equal(writtenFiles.size, 1);
		const [, scriptContent] = Array.from(writtenFiles.entries())[0];

		assert.ok(scriptContent.includes(`$newExe = '${newExe}'`));
		assert.ok(scriptContent.includes(`$currentExe = '${currentExe}'`));
		assert.ok(!scriptContent.includes('C:\\\\Users\\\\test'));
		assert.ok(scriptContent.includes('[System.IO.File]::Exists($newExe)'));
		assert.ok(scriptContent.includes('[System.IO.File]::AppendAllText'));

		assert.equal(spawnedProcesses.length, 1);
	});

	test('isWindowsNsisInstalled identifies NSIS installs and respects portable flags', () => {
		const localAppData = 'C:\\Users\\test\\AppData\\Local';
		const {exports: nsisExports} = loadHelper({
			env: {LOCALAPPDATA: localAppData},
		});
		assert.equal(nsisExports.isWindowsNsisInstalled(), true);

		const {exports: portableExports} = loadHelper({
			env: {
				LOCALAPPDATA: localAppData,
				PORTABLE_EXECUTABLE_DIR: 'D:\\PortableApps',
			},
		});
		assert.equal(portableExports.isWindowsNsisInstalled(), false);
	});
});
