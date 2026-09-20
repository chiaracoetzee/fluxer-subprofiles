// SPDX-License-Identifier: AGPL-3.0-or-later

import Bowser from 'bowser';

const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

const getPlatformType = (): string => {
	if (!userAgent) return 'desktop';
	try {
		return Bowser.getParser(userAgent).getPlatformType() || 'desktop';
	} catch {
		return 'desktop';
	}
};

const platformType = getPlatformType();

const isIPadOS =
	typeof navigator !== 'undefined' &&
	navigator.platform === 'MacIntel' &&
	navigator.maxTouchPoints > 1;

const isIOSDevice = /iPad|iPhone|iPod/i.test(userAgent) || isIPadOS;
const isAndroidDevice = /Android/i.test(userAgent);
const isElectron =
	typeof window !== 'undefined' &&
	(
		window as {
			electron?: unknown;
		}
	).electron !== undefined;
const isIOSWeb = isIOSDevice && !isElectron;
const isPWA =
	typeof window !== 'undefined' &&
	(window.matchMedia?.('(display-mode: standalone)').matches ||
		(
			navigator as {
				standalone?: boolean;
			}
		).standalone === true);

const isMobileDevice = platformType === 'mobile';
const isTabletDevice = platformType === 'tablet' || isIPadOS;
const isMobileBrowser = isMobileDevice || isTabletDevice;
const isDesktop = !isMobileBrowser;


type PlatformSelector<T> = {
	web?: T;
	ios?: T;
	android?: T;
	electron?: T;
	default?: T;
};

function selectValue<T>(options: PlatformSelector<T>): T | undefined {
	if (isElectron && options.electron !== undefined) {
		return options.electron;
	}
	if (isIOSDevice && options.ios !== undefined) {
		return options.ios;
	}
	if (isAndroidDevice && options.android !== undefined) {
		return options.android;
	}
	if (options.web !== undefined) {
		return options.web;
	}
	return options.default;
}

export const Platform = {
	OS: 'web' as const,
	isWeb: true,
	isIOS: isIOSDevice,
	isAndroid: isAndroidDevice,
	isElectron,
	isIOSWeb,
	isPWA,
	isAppleDevice: isIOSDevice,
	isMobileBrowser,
	isMobileDevice,
	isTabletDevice,
	isDesktop,
	select: selectValue,
};

export function isWebPlatform(): boolean {
	return Platform.isWeb;
}

export function isElectronPlatform(): boolean {
	return Platform.isElectron;
}

export function getNativeLocaleIdentifier(): string | null {
	const languages = navigator.languages;
	if (Array.isArray(languages) && languages.length > 0) {
		return languages[0];
	}
	return navigator.language ?? null;
}
