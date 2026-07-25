// Runtime bridge for @toolcase/web-components in React.
// Provides hooks to wire tc-* custom events and set JS-only instance properties
// (objects/arrays) that React cannot pass as string HTML attributes.
import { useCallback, useEffect, useInsertionEffect, useRef } from 'react'
import type { RefCallback } from 'react'

export type TcEventHandler<D = unknown> = (e: CustomEvent<D>) => void

/** Map of DOM event names to handlers. Accepts both tc-* custom events and
 *  standard DOM events (e.g. 'change', 'input'). */
export type TcEventMap = Record<string, TcEventHandler | EventListener>

/**
 * Return value of {@link useTc}. It is a callback ref — pass it straight to a
 * tc-* element's `ref`. It also exposes a live `.current` getter so imperative
 * code (e.g. clearing a value, focusing) keeps working exactly like the old
 * `RefObject` return did.
 */
export type TcRef<E extends HTMLElement = HTMLElement> = RefCallback<E> & {
    /** Live element handle for imperative access. Read-only. */
    readonly current: E | null
}

// Builds the stable callback ref handed to React, augmented with a `.current`
// getter. Detaches listeners from the previous node and (re)attaches them —
// plus re-applies instance props — whenever the underlying node changes.
function createCallbackRef<E extends HTMLElement>(
    elRef: { current: E | null },
    attachedRef: { current: Array<[string, EventListener]> },
    appliedRef: { current: Record<string, unknown> },
    onRef: { current: TcEventMap },
    applyProps: () => void
): TcRef<E> {
    const fn = ((el: E | null) => {
        if (elRef.current === el) return
        // Detach from the previous node.
        if (elRef.current) {
            attachedRef.current.forEach(([event, listener]) =>
                elRef.current?.removeEventListener(event, listener)
            )
        }
        attachedRef.current = []
        appliedRef.current = {}
        elRef.current = el
        if (!el) return
        // (Re)attach listeners. The wrapper reads onRef.current so handler
        // identity can change between renders without re-registering.
        for (const event of Object.keys(onRef.current)) {
            const listener: EventListener = (domEvent) => {
                const handler = onRef.current[event]
                if (handler) (handler as (e: Event) => void)(domEvent)
            }
            el.addEventListener(event, listener)
            attachedRef.current.push([event, listener])
        }
        applyProps()
    }) as TcRef<E>
    Object.defineProperty(fn, 'current', { get: () => elRef.current })
    return fn
}

/**
 * Wire a custom-element ref with instance props (objects/arrays that React
 * cannot pass as attributes) and/or tc-* event listeners.
 *
 * The returned value is a callback ref with a `.current` getter, so both
 * `<tc-list ref={r} />` and `r.current` work.
 *
 * Two bugs the naive "assign every prop in a useEffect + attach listeners on
 * mount" approach has, and how this hook avoids them:
 *
 *  - **Focus loss.** Reassigning an instance prop makes the custom element
 *    re-render its light DOM, destroying a focused `<input>` mid-typing. React
 *    hands us a brand-new `onChange` closure on every render, so a blind
 *    reassign nukes focus on every keystroke. This hook assigns a prop only
 *    when its value actually changed, and wraps function props in a stable
 *    proxy that always calls the latest closure — so callbacks are assigned
 *    exactly once and never re-trigger a re-render.
 *
 *  - **Dead component after remount.** A `RefObject` never tells us when React
 *    swaps the underlying DOM node, so listeners attached on first mount are
 *    lost after a remount. This hook uses a callback ref: it re-attaches
 *    listeners and re-applies props whenever the element is (re)mounted.
 *
 * Field errors: pass a `validate` function as an instance prop, never an
 * `error` JSX attribute. Flipping the `error` attribute goes through the
 * component's attributeChangedCallback, which rebuilds its innerHTML and
 * destroys the focused `<input>` mid-typing; `validate` swaps only the message
 * slot and is gated by `validate-on`.
 *
 * @param instanceProps - JS properties set directly on the element after mount
 *   and whenever a value changes (reference-compared). Use for arrays, objects,
 *   functions, or any value React would stringify as a JSX attribute.
 * @param on - Map of event names to handlers. Listeners are attached on mount
 *   (and re-attached on remount) and removed on unmount. The wrapper always
 *   calls the latest closure, so handler changes take effect without
 *   re-registering. Event names are read once per (re)mount — keep them static.
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
): TcRef<E> {
    const elRef = useRef<E | null>(null)
    // Values last written to the element, keyed by prop name. Used to skip
    // no-op reassignments that would otherwise force a DOM re-render.
    const appliedRef = useRef<Record<string, unknown>>({})
    // Latest props/handlers, so the stable proxies and listeners always call
    // through to the current closure without re-registering. Written in an
    // insertion effect (never during render, which React may replay/discard);
    // it fires before callback refs attach, so a remount in the same commit
    // still applies the latest values.
    const propsRef = useRef(instanceProps)
    const onRef = useRef(on)
    useInsertionEffect(() => {
        propsRef.current = instanceProps
        onRef.current = on
    })
    // Stable function proxies, created once per prop key, that delegate to the
    // current closure in propsRef. Assigned to the element exactly once.
    const stableFnsRef = useRef<Record<string, unknown>>({})
    const attachedRef = useRef<Array<[string, EventListener]>>([])

    // Apply instance props, skipping any whose value is unchanged since the
    // last write. Function props are replaced by their stable proxy so a fresh
    // closure on every render never counts as a change.
    const applyProps = useCallback(() => {
        const el = elRef.current
        if (!el) return
        for (const [key, value] of Object.entries(propsRef.current)) {
            let next = value
            if (typeof value === 'function') {
                if (!stableFnsRef.current[key]) {
                    stableFnsRef.current[key] = (...args: unknown[]) =>
                        (
                            propsRef.current[key] as
                                | ((...fnArgs: unknown[]) => unknown)
                                | undefined
                        )?.(...args)
                }
                next = stableFnsRef.current[key]
            }
            if (appliedRef.current[key] !== next) {
                ;(el as Record<string, unknown>)[key] = next
                appliedRef.current[key] = next
            }
        }
    }, [])

    // A single stable callback ref, lazily created once (null-guarded init).
    // React calls it on mount, unmount, and whenever the underlying node
    // changes — which is what lets us re-attach listeners on remount.
    const tcRef = useRef<TcRef<E> | null>(null)
    if (tcRef.current === null) {
        tcRef.current = createCallbackRef(elRef, attachedRef, appliedRef, onRef, applyProps)
    }

    // Re-apply props after every render so the element stays in sync with
    // React state; applyProps() diffs, so unchanged values are cheap no-ops.
    useEffect(() => {
        applyProps()
    })

    return tcRef.current
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
): TcRef<E> {
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
