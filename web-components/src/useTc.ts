// Runtime bridge for @toolcase/web-components in React.
// Provides hooks to wire tc-* custom events and set JS-only instance properties
// (objects/arrays) that React cannot pass as string HTML attributes.
import { useRef, useEffect } from 'react'
import type { RefObject } from 'react'

export type TcEventHandler<D = unknown> = (e: CustomEvent<D>) => void

/** Map of DOM event names to handlers. Accepts both tc-* custom events and
 *  standard DOM events (e.g. 'change', 'input'). */
export type TcEventMap = Record<string, TcEventHandler | EventListener>

/**
 * Wire a custom-element ref with instance props (objects/arrays that React
 * cannot pass as attributes) and/or tc-* event listeners.
 *
 * @param instanceProps - JS properties set directly on the element after mount
 *   and whenever the values change. Use for arrays, objects, or any value that
 *   React would stringify when passed as a JSX attribute.
 * @param on - Map of event names to handlers. Listeners are attached once on
 *   mount and removed on unmount. Handler functions are always the latest
 *   closure even though the listener itself is stable.
 *
 * @example
 * const ref = useTc<HTMLElement>(
 *   { items: myArray },
 *   { 'tc-select': (e) => console.log(e.detail) }
 * )
 * return <tc-list ref={ref} />
 */
export function useTc<E extends HTMLElement = HTMLElement>(
    instanceProps: Record<string, unknown>,
    on: TcEventMap = {}
): RefObject<E> {
    const ref = useRef<E>(null)

    // Keep a ref to the latest handlers so wrappers attached on mount always
    // call the current closure without needing to re-register.
    const onRef = useRef<TcEventMap>(on)
    onRef.current = on

    // Attach event listeners once on mount; remove on unmount.
    // The wrapper delegates to onRef.current so handler changes take effect
    // immediately without re-attaching.
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const eventNames = Object.keys(on)
        const pairs = eventNames.map((event) => {
            const fn: EventListener = (e) => {
                const handler = onRef.current[event]
                if (handler) handler(e as CustomEvent)
            }
            el.addEventListener(event, fn)
            return { event, fn }
        })
        return () => {
            pairs.forEach(({ event, fn }) => el.removeEventListener(event, fn))
        }
        // Mount-only: event names are static; handlers stay current via onRef.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Apply instance props after every render so the element stays in sync with
    // React state (arrays/objects that cannot be set as string attributes).
    useEffect(() => {
        const el = ref.current
        if (!el) return
        Object.entries(instanceProps).forEach(([k, v]) => {
            ;(el as Record<string, unknown>)[k] = v
        })
    })

    return ref as RefObject<E>
}

/**
 * Wire tc-* event listeners on a custom element without setting instance props.
 * Sugar for `useTc({}, on)`.
 *
 * @example
 * const ref = useTcEvents<HTMLElement>({ 'tc-change': (e) => setValue(detailValue(e)) })
 * return <tc-switch ref={ref} />
 */
export function useTcEvents<E extends HTMLElement = HTMLElement>(
    on: TcEventMap
): RefObject<E> {
    return useTc<E>({}, on)
}

/**
 * Extract `event.detail.value` from a tc-* CustomEvent.
 * Convenience for the common `{ value: T }` detail shape used by most
 * interactive toolcase components (tc-switch, tc-toggle, tc-slider, …).
 *
 * @example
 * useTcEvents({ 'tc-change': (e) => setOn(detailValue<boolean>(e)) })
 */
export function detailValue<T = unknown>(e: CustomEvent): T {
    return (e as CustomEvent<{ value: T }>).detail?.value as T
}
