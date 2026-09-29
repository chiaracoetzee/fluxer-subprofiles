// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {runInAction} from 'mobx';

await vi.hoisted(async () => {
	const {installVoiceMenuTestBootstrap} = await import(
		'@app/features/ui/action_menu/items/__fixtures__/VoiceMenuTestBootstrap'
	);
	installVoiceMenuTestBootstrap();
});

vi.mock('framer-motion', async () => {
	const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
	return {
		...actual,
		motion: {
			div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => <div ref={ref} {...props} />),
			span: React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>((props, ref) => <span ref={ref} {...props} />),
		},
	};
});

vi.mock('@lingui/core/macro', () => {
	const descriptor = (value: unknown): unknown => (typeof value === 'string' ? {message: value} : value);
	return {msg: descriptor, t: descriptor, plural: () => '', select: () => '', selectOrdinal: () => ''};
});
vi.mock('@lingui/react/macro', () => ({
	Trans: ({children}: {children?: unknown}) => children ?? null,
	useLingui: () => ({
		i18n: {
			_: (descriptor: {message?: string}, values?: Record<string, unknown>) => {
				let msg = descriptor.message ?? '';
				if (values) {
					for (const [k, v] of Object.entries(values)) {
						msg = msg.replaceAll(`{${k}}`, String(v));
					}
				}
				return msg;
			},
			locale: 'en',
		},
	}),
}));

vi.mock('@app/features/ui/commands/ContextMenuCommands', () => ({
	openFromEvent: vi.fn(),
}));

vi.mock('@app/features/emoji/commands/EmojiPickerCommands', () => ({
	trackEmojiUsage: vi.fn(),
}));

vi.mock('@app/features/ui/tooltip/Tooltip', () => ({
	Tooltip: ({children, text}: {children: React.ReactNode; text?: any}) => (
		<>
			{children}
			<div data-testid="tooltip-text">{typeof text === 'function' ? text() : text}</div>
		</>
	),
}));

import {QuickReactionButton} from './MessageActionBar';
import {EmojiRenderer} from './emoji_picker/EmojiRenderer';
import EmojiPicker from '@app/features/emoji/state/EmojiPicker';
import {PersonaStore} from '@app/features/persona/state/PersonaStore';
import * as ContextMenuCommands from '@app/features/ui/commands/ContextMenuCommands';
import * as EmojiPickerCommands from '@app/features/emoji/commands/EmojiPickerCommands';
import type {FlatEmoji} from '@app/features/emoji/types/EmojiTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('QuickReactionButton', () => {
	let container: HTMLDivElement;
	let root: Root;
	const mockOnReact = vi.fn();

	const testEmoji: FlatEmoji = {
		name: 'heart',
		surrogates: '❤️',
		uniqueName: 'heart',
		allNamesString: ':heart:',
		animated: false,
	};

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		root = createRoot(container);
		mockOnReact.mockClear();
		vi.clearAllMocks();

		runInAction(() => {
			PersonaStore.setPersonas([
				{
					id: 'p1',
					name: 'Fox Persona',
				} as any,
			]);
		});
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
		document.body.replaceChildren();
		vi.clearAllMocks();
	});

	it('triggers onReact and tracks emoji usage on click', async () => {
		await act(async () => {
			root.render(
				<QuickReactionButton
					emoji={testEmoji}
					onReact={mockOnReact}
					channelId="ch-100"
					messageId="msg-200"
				/>,
			);
		});

		const button = container.querySelector('button')!;
		expect(button).toBeTruthy();

		await act(async () => {
			button.click();
		});

		expect(mockOnReact).toHaveBeenCalledWith(testEmoji);
		expect(EmojiPickerCommands.trackEmojiUsage).toHaveBeenCalledWith(testEmoji, undefined);
	});

	it('opens context menu with channelId and messageId on right-click (contextmenu event)', async () => {
		await act(async () => {
			root.render(
				<QuickReactionButton
					emoji={testEmoji}
					onReact={mockOnReact}
					channelId="ch-100"
					messageId="msg-200"
				/>,
			);
		});

		const button = container.querySelector('button')!;
		expect(button).toBeTruthy();

		await act(async () => {
			button.dispatchEvent(
				new MouseEvent('contextmenu', {
					bubbles: true,
					cancelable: true,
					clientX: 150,
					clientY: 250,
				}),
			);
		});

		expect(ContextMenuCommands.openFromEvent).toHaveBeenCalledTimes(1);
		const [, renderMenu] = vi.mocked(ContextMenuCommands.openFromEvent).mock.calls[0];
		expect(typeof renderMenu).toBe('function');

		// Render the menu factory returned by openFromEvent to verify it constructs EmojiContextMenuItems
		const renderedMenu = renderMenu({onClose: vi.fn()} as any) as any;
		expect(renderedMenu).toBeTruthy();
		expect(renderedMenu?.props?.channelId).toBe('ch-100');
		expect(renderedMenu?.props?.messageId).toBe('msg-200');
		expect(renderedMenu?.props?.emoji).toEqual(testEmoji);
	});

	it('displays tiny pin badge in tooltip when emoji is pinned', async () => {
		EmojiPicker.resetPinnedEmojis();
		EmojiPicker.pinEmoji('unicode:heart');

		await act(async () => {
			root.render(
				<QuickReactionButton
					emoji={testEmoji}
					onReact={mockOnReact}
					channelId="ch-100"
					messageId="msg-200"
				/>,
			);
		});

		const tooltip = container.querySelector('[data-testid="tooltip-text"]')!;
		expect(tooltip.textContent).toContain(':heart:');
		expect(tooltip.textContent).not.toContain('(pinned)');

		const pinnedBadge = container.querySelector('[data-flx="channel.message-action-bar.tooltip-pinned-badge"]');
		expect(pinnedBadge).toBeTruthy();

		// Button itself should not have a pinned badge
		expect(container.querySelector('[data-flx="channel.message-action-bar.pinned-badge"]')).toBeNull();

		// Unpin and verify pinned badge disappears
		EmojiPicker.unpinEmoji('unicode:heart');
		await act(async () => {
			root.render(
				<QuickReactionButton
					emoji={testEmoji}
					onReact={mockOnReact}
					channelId="ch-100"
					messageId="msg-200"
				/>,
			);
		});
		expect(container.querySelector('[data-flx="channel.message-action-bar.tooltip-pinned-badge"]')).toBeNull();
	});
});

describe('EmojiRenderer Pinning', () => {
	let container: HTMLDivElement;
	let root: Root;

	const testEmoji: FlatEmoji = {
		name: 'heart',
		surrogates: '❤️',
		uniqueName: 'heart',
		allNamesString: ':heart:',
		animated: false,
	};

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		root = createRoot(container);
		vi.clearAllMocks();
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
		document.body.replaceChildren();
	});

	it('renders pinned badge inside emoji picker tile when emoji is pinned', async () => {
		EmojiPicker.resetPinnedEmojis();
		EmojiPicker.pinEmoji('unicode:heart');

		await act(async () => {
			root.render(
				<EmojiRenderer
					emoji={testEmoji}
					handleHover={vi.fn()}
					handleSelect={vi.fn()}
					skinTone=""
					channel={null}
					shouldAnimate={false}
				/>,
			);
		});

		const pinnedBadge = container.querySelector('[data-flx="channel.emoji-picker.emoji-renderer.pinned-badge"]');
		expect(pinnedBadge).toBeTruthy();

		// Unpin and verify pinned badge disappears
		EmojiPicker.unpinEmoji('unicode:heart');
		await act(async () => {
			root.render(
				<EmojiRenderer
					emoji={testEmoji}
					handleHover={vi.fn()}
					handleSelect={vi.fn()}
					skinTone=""
					channel={null}
					shouldAnimate={false}
				/>,
			);
		});
		expect(container.querySelector('[data-flx="channel.emoji-picker.emoji-renderer.pinned-badge"]')).toBeNull();
	});
});
