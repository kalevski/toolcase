'use client'

// React hooks that three consuming apps wrote independently.
//
// The bar for a hook living here rather than in an app is the same as for an
// element: it has to be about the LIBRARY's surface or about the browser, not
// about the app's own domain. `useAuth`, `useCan`, `useFeature` and friends are
// in all three apps too and are deliberately NOT here — they are shaped by each
// app's own permission model.
//
// Exported from `@toolcase/web-components/react`, alongside useTc.

import { useCallback, useEffect, useRef, useState } from 'react'

// ── useVisiblePoll ───────────────────────────────────────────────────────────

/**
 * Run `callback` every `interval` ms, but only while the tab is visible.
 *
 * In polovni.mk and mindmap, both for the same reason: a plain `setInterval`
 * keeps refetching for the eight hours a phone spends in a pocket with the tab
 * backgrounded, and then delivers a burst of stale responses on resume. Pausing
 * on `visibilitychange` costs four lines and is the difference between a live
 * element and a battery complaint.
 *
 * It fires ONCE on becoming visible again before resuming the interval, because
 * the whole point of coming back to a live surface is that it is current.
 *
 * @param callback - what to run. Read from a ref, so a fresh closure on every
 *   render never restarts the timer.
 * @param interval - ms between runs. `null` stops the poll entirely, which is
 *   how a consumer turns it off without violating the rules of hooks.
 * @param options.immediate - run once on mount as well. Default `false`.
 */
export function useVisiblePoll(
    callback: () => void,
    interval: number | null,
    options: { immediate?: boolean } = {},
): void {
    const latest = useRef(callback)
    const immediate = options.immediate ?? false
    useEffect(() => {
        latest.current = callback
    })

    useEffect(() => {
        if (interval == null || interval <= 0) return
        let timer: ReturnType<typeof setInterval> | null = null

        const stop = (): void => {
            if (timer !== null) clearInterval(timer)
            timer = null
        }
        const start = (): void => {
            stop()
            timer = setInterval(() => latest.current(), interval)
        }
        const onVisibility = (): void => {
            if (document.visibilityState === 'visible') {
                // A run BEFORE the interval restarts: coming back to a live surface
                // that then waits a full period is a surface showing stale data for
                // exactly as long as it is being looked at.
                latest.current()
                start()
            } else {
                stop()
            }
        }

        if (immediate) latest.current()
        if (document.visibilityState === 'visible') start()
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            stop()
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [interval, immediate])
}

// ── useKeyboardReveal ────────────────────────────────────────────────────────

/**
 * The height of the on-screen keyboard, in px, as `tc-mobile-shell` measures it.
 *
 * The shell already publishes `--tc-keyboard-inset` from `visualViewport`; this
 * is the reading half of that feature, which polovni.mk had to write itself
 * because a CSS custom property cannot be read from React without a ref and a
 * `getComputedStyle`.
 *
 * `0` when no keyboard is up, when the shell is absent, or on a platform that
 * does not report one — so a consumer can subtract it unconditionally.
 *
 * @param target - the element to read the property from. Defaults to the shell
 *   the hook finds, then to `document.documentElement`.
 */
export function useKeyboardReveal(target?: HTMLElement | null): number {
    const [inset, setInset] = useState(0)

    useEffect(() => {
        const read = (): void => {
            const node =
                target ??
                document.querySelector<HTMLElement>('tc-mobile-shell') ??
                document.documentElement
            const raw = getComputedStyle(node).getPropertyValue('--tc-keyboard-inset').trim()
            const value = Number.parseFloat(raw)
            setInset(Number.isFinite(value) ? value : 0)
        }

        read()
        // `visualViewport` is what the shell itself listens to, so reading on the
        // same events keeps the two exactly in step — polling would not.
        const viewport = window.visualViewport
        viewport?.addEventListener('resize', read)
        viewport?.addEventListener('scroll', read)
        window.addEventListener('resize', read)
        return () => {
            viewport?.removeEventListener('resize', read)
            viewport?.removeEventListener('scroll', read)
            window.removeEventListener('resize', read)
        }
    }, [target])

    return inset
}

// ── useEditorShortcuts ───────────────────────────────────────────────────────

/** A shortcut map: `'mod+z'`, `'shift+?'`, `'Escape'`, `'delete'`. */
export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>

/** True when the event came from somewhere a keystroke means text. */
const inTextEntry = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable) return true
    const tag = target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Normalise one event into the `mod+shift+key` spelling the map uses. */
const spell = (event: KeyboardEvent): string => {
    const parts: string[] = []
    // `mod` is ⌘ on a Mac and Ctrl elsewhere, which is the only way one map can
    // describe a shortcut without the consumer branching on platform.
    if (event.metaKey || event.ctrlKey) parts.push('mod')
    if (event.altKey) parts.push('alt')
    if (event.shiftKey) parts.push('shift')
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    parts.push(key)
    return parts.join('+')
}

/**
 * Bind a keyboard map for an editor surface.
 *
 * In webgame.cloud and mindmap, both wrapping the same editor set this library
 * now ships (`tc-editor-shell`, `tc-design-canvas`, `tc-zoom-control`). Two
 * decisions are why it is worth sharing rather than rewriting per app:
 *
 *  - **A keystroke in a field is text.** Every shortcut is suppressed while focus
 *    is in an input, a textarea, a select or a contenteditable — except `Escape`,
 *    which means "get me out of this" everywhere and is the one shortcut a reader
 *    reaches for from inside a field.
 *  - **`mod` is one name for two keys.** ⌘ on a Mac, Ctrl elsewhere; a map that
 *    spells them separately is a map that is wrong on one platform.
 *
 * @param map - shortcut spelling to handler. Read from a ref, so a fresh object
 *   on every render never re-binds the listener.
 * @param options.enabled - default `true`. `false` unbinds without unmounting.
 * @param options.target - where to listen. Defaults to `window`.
 */
export function useEditorShortcuts(
    map: ShortcutMap,
    options: { enabled?: boolean; target?: HTMLElement | null } = {},
): void {
    const latest = useRef(map)
    const enabled = options.enabled ?? true
    const target = options.target
    useEffect(() => {
        latest.current = map
    })

    useEffect(() => {
        if (!enabled) return
        const node: EventTarget = target ?? window
        const onKeydown = (event: Event): void => {
            const keyboard = event as KeyboardEvent
            const spelled = spell(keyboard)
            const handler = latest.current[spelled]
            if (!handler) return
            if (inTextEntry(keyboard.target) && keyboard.key !== 'Escape') return
            // The handler decides whether the default matters — a consumer binding
            // `mod+s` wants the browser's Save dialog suppressed, one binding `?`
            // may not. Calling preventDefault here would take that away.
            handler(keyboard)
        }
        node.addEventListener('keydown', onKeydown)
        return () => node.removeEventListener('keydown', onKeydown)
    }, [enabled, target])
}

// ── useFeatureGate ───────────────────────────────────────────────────────────

export interface FeatureGate {
    /** The flag's current state. */
    enabled: boolean
    /** True until the first `resolve` has answered. */
    pending: boolean
    /** Re-ask. Useful after a sign-in, which usually changes every answer. */
    refresh: () => void
}

/**
 * Resolve a feature flag, with the pending state named.
 *
 * polovni.mk and mindmap both wrote this, and both wrote it because the naive
 * version — `const on = useFlag(x)` returning a boolean — cannot distinguish
 * "off" from "not answered yet", so every gated route flashed its fallback for
 * one frame before the real answer arrived. `pending` is the whole point.
 *
 * The resolver is the consumer's: this library has no opinion about where flags
 * come from, only about the shape of the answer.
 *
 * @param resolve - returns the flag, or a promise of it.
 * @param deps - re-resolve when these change. Same contract as `useEffect`.
 */
export function useFeatureGate(
    resolve: () => boolean | Promise<boolean>,
    deps: readonly unknown[] = [],
): FeatureGate {
    const [state, setState] = useState<{ enabled: boolean; pending: boolean }>({
        enabled: false,
        pending: true,
    })
    const latest = useRef(resolve)
    const [nonce, setNonce] = useState(0)
    useEffect(() => {
        latest.current = resolve
    })

    useEffect(() => {
        let live = true
        setState((previous) => (previous.pending ? previous : { ...previous, pending: true }))
        void Promise.resolve(latest.current())
            .then((enabled) => {
                // A resolver that answers after the component has gone is not an
                // error, so it is dropped rather than reported.
                if (live) setState({ enabled, pending: false })
            })
            .catch(() => {
                // A gate that cannot be resolved is CLOSED. Failing open would let a
                // network error hand out a feature nobody is entitled to.
                if (live) setState({ enabled: false, pending: false })
            })
        return () => {
            live = false
        }
        // The dependency list is the CONSUMER's, spread in — an exhaustive-deps
        // rule cannot see through that and neither can this file. `resolve` itself
        // is deliberately absent: it is read from a ref, so a fresh closure on
        // every render must not re-resolve the gate.
    }, [nonce, ...deps])

    const refresh = useCallback(() => setNonce((n) => n + 1), [])
    return { enabled: state.enabled, pending: state.pending, refresh }
}
