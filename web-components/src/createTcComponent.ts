'use client'

// The factory behind the generated React wrappers in `./react/components`.
//
// Plain JSX already works — `<tc-button variant="primary" disabled={busy}
// ontc-click={save}>Save</tc-button>` is correct as of this release. What the
// wrappers add is the part JSX cannot do:
//
//   - **JS-only props.** Arrays, objects and callbacks (`items`, `columns`,
//     `validate`, `onOpenChange`) have to be ASSIGNED to the instance. React
//     stringifies them as attributes when the element is not upgraded yet, and
//     there is no JSX spelling that says "property, not attribute".
//   - **camelCase event handlers.** `onTcChange` instead of `'ontc-change'`.
//     The wrapper calls addEventListener itself, so it is free to name the prop
//     the way React names props.
//   - **A typed ref that is the element's own class**, so `ref.current?.show()`
//     needs no cast, and a component name that autocompletes in an editor that
//     knows nothing about custom elements.
//
// Prop routing, in order:
//   1. `children`                          → children
//   2. a name in the element's event map   → addEventListener
//   3. a name in the element's JS-prop set → assigned to the instance
//   4. a name in the element's attribute set (camelCase or kebab-case)
//                                          → passed to React as that attribute
//   5. anything else                       → passed straight through
//      (className, style, id, slot, data-*, aria-*, React's own onClick, …)
//
// Step 3 is why the 137 callback-field APIs (`onWishlistToggle` and friends) are
// reachable here at all: React sends ANY unrecognised `on*` prop on a custom
// element to addEventListener, so `onWishlistToggle={fn}` in plain JSX listens
// for an event named `WishlistToggle` and never assigns the property. The wrapper
// knows which names are properties, so it assigns them.
//
// NOT handled here: an element that re-parents your children can still make
// react-dom throw NotFoundError when it removes one of them individually. That is
// a defect in the element, not something an adapter should paper over — see the
// rules in internal/tc-element.ts and the ratchet in
// scripts/check-react-safety.mjs, which is closing them element by element.
import { createElement, forwardRef, useCallback } from 'react'
import type {
    CSSProperties,
    ForwardRefExoticComponent,
    HTMLAttributes,
    ReactNode,
    Ref,
    RefAttributes,
} from 'react'
import { useTc } from './useTc'
import type { TcEventMap } from './useTc'

/** Everything the generator knows about one element's prop surface. */
export interface TcComponentConfig {
    /** kebab-case attributes the element observes. */
    attributes?: readonly string[]
    /** React prop name → DOM event name, e.g. `{ onTcChange: 'tc-change' }`. */
    events?: Readonly<Record<string, string>>
    /** Public JS properties that must be assigned, never stringified. */
    properties?: readonly string[]
}

/**
 * The props every wrapper accepts on top of its own element's: the standard HTML
 * attribute set React knows (className, style, id, role, tabIndex, onClick, every
 * `aria-*`) plus `data-*`, which a React COMPONENT — unlike an intrinsic element —
 * would otherwise reject as an excess property.
 *
 * Each element's own props are intersected with this, never `extends`-ed: an
 * element that declares `title` as `string | number` conflicts with
 * `HTMLAttributes['title']`, and an interface may not narrow an inherited member
 * while an intersection may.
 */
export type TcBaseProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
    children?: ReactNode
    style?: CSSProperties
    [dataAttribute: `data-${string}`]: unknown
}

const camelToKebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/**
 * Build a React component for one tc-* tag.
 *
 * `P` carries the WHOLE prop surface, TcBaseProps included — the generated types
 * intersect it in themselves. Adding it again here would re-introduce the React
 * members an element deliberately overrides (tc-form-input's `onChange` is
 * `(value, hasError) => void`, not a FormEventHandler) as an unsatisfiable
 * intersection.
 *
 * @param tagName - the custom element's tag, e.g. `'tc-button'`.
 * @param config - the element's attribute / event / property surface.
 */
// `E` is unconstrained for the same reason TcProps's is: tc-diff-viewer and
// tc-offcanvas each declare a member that collides with an HTMLElement method
// (`after`, `scroll`), so neither satisfies `E extends HTMLElement`.
export function createTcComponent<P extends object, E = HTMLElement>(
    tagName: string,
    config: TcComponentConfig = {},
): ForwardRefExoticComponent<P & RefAttributes<E>> {
    const attributes = new Set(config.attributes ?? [])
    const properties = new Set(config.properties ?? [])
    const events = config.events ?? {}
    // Prop name → DOM event name, resolved once per element rather than per render.
    const eventEntries = Object.entries(events)

    const Component = forwardRef<E, P>(function TcComponent(props, forwardedRef) {
        const source = props as Record<string, unknown>
        const children = source.children as ReactNode

        const domProps: Record<string, unknown> = {}
        const instanceProps: Record<string, unknown> = {}

        for (const key of Object.keys(source)) {
            if (key === 'children' || key in events) continue
            const value = source[key]
            if (properties.has(key)) {
                instanceProps[key] = value
                continue
            }
            if (attributes.has(key)) {
                domProps[key] = value
                continue
            }
            const kebab = camelToKebab(key)
            if (attributes.has(kebab)) {
                domProps[kebab] = value
                continue
            }
            domProps[key] = value
        }

        // EVERY event the element can fire gets a listener, not only the ones with
        // a handler on this render: useTc reads the event-name set once per mount,
        // so a handler that appears later would otherwise never be wired. The
        // dispatcher reads the live prop, which costs one closure per event.
        const on: TcEventMap = {}
        for (const [prop, eventName] of eventEntries) {
            on[eventName] = (event: Event) => {
                const handler = (props as Record<string, unknown>)[prop]
                if (typeof handler === 'function') (handler as (e: Event) => void)(event)
            }
        }

        const tcRef = useTc<HTMLElement>(instanceProps, on)
        const ref = useCallback(
            (el: E | null) => {
                tcRef(el as HTMLElement | null)
                if (typeof forwardedRef === 'function') forwardedRef(el)
                else if (forwardedRef) (forwardedRef as { current: E | null }).current = el
            },
            [tcRef, forwardedRef],
        )

        return createElement(tagName, { ...domProps, ref: ref as Ref<E> }, children)
    })

    Component.displayName = tagName
    return Component as unknown as ForwardRefExoticComponent<P & RefAttributes<E>>
}
