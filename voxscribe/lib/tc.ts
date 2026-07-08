'use client'

// React 18 ↔ web-components interop.
//
// React 18 cannot set object/array values as DOM *properties* through JSX (it
// stringifies everything into attributes) and cannot subscribe to custom DOM
// events through JSX `onX` props. Both are required to drive `tc-*` custom
// elements: charts/tables/selects take rich data as element properties, and
// form/overlay elements report changes via `change`/`input`/`tc-*` CustomEvents.
//
// These hooks return a ref you attach to the `tc-*` element. `useTc` does both;
// `useTcProps`/`useTcEvents` are conveniences over it.
//
// Caller contract: pass a STABLE set of keys (don't conditionally add/remove
// keys between renders — deps length must stay constant) and `useMemo`
// array/object property values so identity only changes when the data does.

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

type Handler = (event: any) => void

// Properties apply in a layout effect so they land before paint (no flash of an
// empty table/select); on the server there is no layout phase, so fall back to
// useEffect to avoid the React SSR warning. `tc-*` only ever mount client-side.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function useTc<E extends HTMLElement = HTMLElement>(
    props?: Record<string, unknown>,
    handlers?: Record<string, Handler>,
): RefObject<E | null> {
    // A *callback ref* — not useRef — is the key. It fires exactly when the element
    // attaches (with the node) and detaches (with null), so it works even for tc-*
    // that mount AFTER the owning component's first render (conditional JSX, e.g.
    // `{commitAfter && <tc-radio-group …>}`). A deps-gated useEffect would never
    // re-run for that late-attached node, leaving its object props (`options`,
    // `series`, …) unset and its CustomEvent handlers unbound. The callback form
    // also pairs attach/detach correctly under React StrictMode's dev remount.
    const propsRef = useRef(props)
    propsRef.current = props
    const handlersRef = useRef(handlers)
    handlersRef.current = handlers
    const elRef = useRef<E | null>(null)
    const cleanupRef = useRef<(() => void) | null>(null)

    const setRef = useCallback((node: E | null) => {
        // Detach from the previous node first (remove its event listeners).
        if (cleanupRef.current) {
            cleanupRef.current()
            cleanupRef.current = null
        }
        elRef.current = node
        if (!node) return

        // Apply object/array props as element *properties* (JSX can only set them
        // as stringified attributes, which custom elements can't consume).
        const p = propsRef.current
        if (p) for (const [key, value] of Object.entries(p)) (node as any)[key] = value

        // Bind CustomEvent listeners; handlers are read live from the ref so they
        // can change between renders without rebinding.
        const names = handlersRef.current ? Object.keys(handlersRef.current) : []
        const listeners = names.map((name) => {
            const listener = (event: Event) => handlersRef.current?.[name]?.(event)
            node.addEventListener(name, listener)
            return [name, listener] as const
        })
        if (listeners.length) {
            cleanupRef.current = () => listeners.forEach(([name, l]) => node.removeEventListener(name, l))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Re-apply props when their VALUES change on an already-attached element (the
    // callback ref only fires on attach/detach, not on data updates). useMemo the
    // values at call sites so identity changes only when the data actually does.
    const propValues = props ? Object.values(props) : []
    useIsoLayoutEffect(() => {
        const el = elRef.current
        const p = propsRef.current
        if (!el || !p) return
        for (const [key, value] of Object.entries(p)) (el as any)[key] = value
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, propValues)

    // Expose `.current` (live node) so callers can still read the element, while
    // the value React receives is the callback form. Defined once on the stable
    // setRef identity.
    if (!Object.prototype.hasOwnProperty.call(setRef, 'current')) {
        Object.defineProperty(setRef, 'current', { get: () => elRef.current })
    }
    return setRef as unknown as RefObject<E | null>
}

export function useTcProps<E extends HTMLElement = HTMLElement>(props: Record<string, unknown>): RefObject<E | null> {
    return useTc<E>(props, undefined)
}

export function useTcEvents<E extends HTMLElement = HTMLElement>(handlers: Record<string, Handler>): RefObject<E | null> {
    return useTc<E>(undefined, handlers)
}

/**
 * HTML-escape a value for safe interpolation into a `tc-table` `render` cell
 * (those return an HTML *string*, not React, so user data must be escaped to
 * avoid markup injection). Mirrors web-components' internal `esc`.
 */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/**
 * Escape an FTS `snippet()` string for cell injection. The snippet is RAW note
 * or transcript content with literal `<mark>`/`</mark>` wrappers around hits —
 * escape everything, then re-enable only the mark tokens, so user content can
 * never inject markup while highlights still render.
 */
export function escapeSnippetHtml(snippet: string): string {
    return escapeHtml(snippet).replace(/&lt;mark&gt;/g, '<mark>').replace(/&lt;\/mark&gt;/g, '</mark>')
}

/** Read `.value` off a custom-event target (form elements delegate it). */
export function targetValue(event: Event): string {
    return (event.target as any)?.value ?? ''
}

/** Read `.checked` off a custom-event target. */
export function targetChecked(event: Event): boolean {
    return Boolean((event.target as any)?.checked)
}

/** Read `detail.value` off a `tc-change` CustomEvent (switch/number/markdown/etc). */
export function detailValue<T = any>(event: Event): T {
    return (event as CustomEvent).detail?.value
}
