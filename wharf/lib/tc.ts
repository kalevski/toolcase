'use client'

// React 18/19 ↔ web-components interop (copied verbatim from the blueprint).
//
// React cannot set object/array values as DOM *properties* through JSX (it
// stringifies everything into attributes) and cannot subscribe to custom DOM
// events through JSX `onX` props. Both are required to drive `tc-*` custom
// elements: charts/tables/selects take rich data as element properties, and
// form/overlay elements report changes via `change`/`input`/`tc-*` CustomEvents.
//
// These hooks return a ref you attach to the `tc-*` element. `useTc` does both;
// `useTcProps`/`useTcEvents` are conveniences over it.
//
// Caller contract: pass a STABLE set of keys (don't conditionally add/remove keys
// between renders) and `useMemo` array/object property values so identity only
// changes when the data does.

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

type Handler = (event: any) => void

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function useTc<E extends HTMLElement = HTMLElement>(
    props?: Record<string, unknown>,
    handlers?: Record<string, Handler>,
): RefObject<E | null> {
    const propsRef = useRef(props)
    propsRef.current = props
    const handlersRef = useRef(handlers)
    handlersRef.current = handlers
    const elRef = useRef<E | null>(null)
    const cleanupRef = useRef<(() => void) | null>(null)

    const setRef = useCallback((node: E | null) => {
        if (cleanupRef.current) {
            cleanupRef.current()
            cleanupRef.current = null
        }
        elRef.current = node
        if (!node) return

        const p = propsRef.current
        if (p) for (const [key, value] of Object.entries(p)) (node as any)[key] = value

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

    const propValues = props ? Object.values(props) : []
    useIsoLayoutEffect(() => {
        const el = elRef.current
        const p = propsRef.current
        if (!el || !p) return
        for (const [key, value] of Object.entries(p)) (el as any)[key] = value
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, propValues)

    if (!Object.prototype.hasOwnProperty.call(setRef, 'current')) {
        Object.defineProperty(setRef, 'current', { get: () => elRef.current })
    }
    return setRef as unknown as RefObject<E | null>
}

export function useTcProps<E extends HTMLElement = HTMLElement>(
    props: Record<string, unknown>,
): RefObject<E | null> {
    return useTc<E>(props, undefined)
}

export function useTcEvents<E extends HTMLElement = HTMLElement>(
    handlers: Record<string, Handler>,
): RefObject<E | null> {
    return useTc<E>(undefined, handlers)
}

/** HTML-escape a value for safe interpolation into a `tc-table` `render` cell. */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/** Read `.value` off a custom-event target (form elements delegate it). */
export function targetValue(event: Event): string {
    return (event.target as any)?.value ?? ''
}

/** Read `.checked` off a custom-event target. */
export function targetChecked(event: Event): boolean {
    return Boolean((event.target as any)?.checked)
}

/** Read `detail.value` off a `tc-change` CustomEvent. */
export function detailValue<T = any>(event: Event): T {
    return (event as CustomEvent).detail?.value
}
