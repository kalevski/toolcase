// The five rules that make a tc-* element safe to render from React, and the
// shared machinery that enforces them.
//
//  1. Never move a node you did not create. Element-owned nodes are prepended or
//     appended; consumer children stay exactly where the consumer put them.
//     React records the host as the parent of the children it created, so a
//     re-parented child makes `parentInstance.removeChild(child)` throw
//     NotFoundError and the route renders blank.
//     The exception, for the seven elements whose chrome must CONTAIN the
//     consumer's content (a dropdown menu, an accordion body, a `<tbody>`): move
//     the children through `adoptChildren` (./adopt-children.ts), which makes the
//     host forward those mutations to wherever the child actually went. Moving
//     them by hand is still rule 1.
//  2. Build structure once, patch it forever. `attributeChangedCallback` never
//     reassigns `innerHTML` — that destroys React-managed children and drops the
//     caret out of a focused input.
//  3. Every accessor survives a pre-upgrade write. See replayUpgradedProperties.
//  4. Every setter coerces. `'false'`, `''`, `0`, `null` and `undefined` all mean
//     what a React author means by them.
//  5. Self-initiated state changes reflect back to the attribute and emit an
//     event. State a consumer can set is state the consumer can observe.
//  6. Anything COPIED out of the consumer's content is watched. A render is
//     driven by `attributeChangedCallback`, and React changes children without
//     touching an attribute — so a derived `aria-label`, a highlighted code
//     block or an option list built from `<tc-option>` goes stale on the first
//     re-render unless `observeContent` (./content-observer.ts) is watching. Read
//     the source with `consumerText`, never `this.textContent`, which by then
//     includes the element's own markup.
//
// scripts/check-react-safety.mjs checks 1, 2 and 4 statically; rule 3 is handled
// for every registered element by installPropertyReplay (see src/register.ts).

/**
 * Rule 4, the boolean case. React hands a custom element strings, numbers, null
 * and undefined for things the element models as a boolean — and `'false'` is a
 * *string*, so it is truthy under a naive check. This is the one coercion every
 * presence-based setter should use.
 */
export const bool = (v: unknown): boolean =>
    v !== false && v !== null && v !== undefined && v !== 0 && v !== '' && v !== 'false'

/** Rule 4, the numeric case — a non-numeric write falls back rather than writing NaN. */
export const num = (v: unknown, fallback: number): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

/** Rule 4, the string case. `null` means "remove the attribute", and `false`
 *  (which React would otherwise stringify to `"false"`) means the same. */
export const str = (v: unknown): string | null =>
    v === null || v === undefined || v === false ? null : String(v)

// Structural, not `Element`: a few components declare a property that collides
// with one on Element (`after`, `scroll`), which makes `this` unassignable to
// Element even though it is one at runtime.
type AttributeHost = {
    setAttribute(name: string, value: string): void
    removeAttribute(name: string): void
}

/**
 * Rule 4 for a string-valued attribute: reflect `value` onto `host`, or take the
 * attribute off when there is no value to reflect.
 *
 * `this.setAttribute(name, v)` is the shape almost every reflecting setter had,
 * and it is wrong for the two values React sends most often. React 19 writes a
 * prop as a PROPERTY whenever the custom element has a matching setter, so
 * `label={user.label}` with nothing loaded yet arrives as `el.label = undefined`
 * and `value={row.note}` from a database arrives as `el.value = null` — and
 * `setAttribute` stringifies both, which is how the literal word "null" ends up
 * rendered in a field or a heading. Removing the attribute is what React does for
 * the same value on a built-in element, and what `str` already specified.
 *
 * Not for an attribute where the string `"false"` is a distinct third state
 * (`auto-close`, `backdrop`, a carousel's `pause`) — those keep their own setter.
 */
export const setAttr = (host: AttributeHost, name: string, value: unknown): void => {
    const next = str(value)
    if (next === null) host.removeAttribute(name)
    else host.setAttribute(name, next)
}

const ACCESSOR_CACHE = new WeakMap<object, Map<string, boolean>>()

/** Does the prototype chain (excluding Object.prototype) define a setter called
 *  `name`? Cached per prototype — the same answer holds for every instance. */
function hasPrototypeSetter(proto: object | null, name: string): boolean {
    if (!proto) return false
    let cache = ACCESSOR_CACHE.get(proto)
    if (!cache) {
        cache = new Map()
        ACCESSOR_CACHE.set(proto, cache)
    }
    const cached = cache.get(name)
    if (cached !== undefined) return cached
    let found = false
    for (let p: object | null = proto; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        const descriptor = Object.getOwnPropertyDescriptor(p, name)
        if (descriptor) {
            found = typeof descriptor.set === 'function'
            break
        }
    }
    cache.set(name, found)
    return found
}

const REPLAYED = new WeakSet<HTMLElement>()

/**
 * Rule 3. A property assigned to an element BEFORE `customElements.define` ran
 * became an own data property, and an own data property permanently shadows the
 * prototype accessor installed at upgrade — the setter never runs again, for the
 * life of that element. Delete the shadow and re-assign so the setter finally
 * sees the value.
 *
 * This is what makes `<tc-x items={rows}/>` work when `register()` is called from
 * a dynamic import, which is exactly what the README recommends for Next.js.
 * Doing it here means neither useTc nor a generated wrapper has to.
 *
 * Only own ENUMERABLE properties are considered, and only those the prototype
 * chain answers with a setter — so a class's own private fields (`_initialised`
 * and friends, which are own enumerable properties too) are left alone. Runs at
 * most once per element: a pre-upgrade write cannot happen after the first
 * connect.
 */
export function replayUpgradedProperties(el: HTMLElement): void {
    if (REPLAYED.has(el)) return
    REPLAYED.add(el)
    const proto = Object.getPrototypeOf(el)
    const record = el as unknown as Record<string, unknown>
    for (const name of Object.keys(record)) {
        if (!hasPrototypeSetter(proto, name)) continue
        const value = record[name]
        delete record[name]
        record[name] = value
    }
}

const PATCHED = new WeakSet<object>()

/**
 * Give a custom element class the rule-3 replay without touching its source.
 * Wraps `connectedCallback` on the class's own prototype (defining it there even
 * when the class inherits one, so the definition shadows and delegates).
 *
 * Called from register.ts's `define()`, which is why all 388 elements get this
 * and no component file has to remember to.
 */
export function installPropertyReplay(ctor: CustomElementConstructor): void {
    const proto = ctor.prototype as HTMLElement & { connectedCallback?: () => void }
    if (PATCHED.has(proto)) return
    PATCHED.add(proto)
    const original = proto.connectedCallback
    Object.defineProperty(proto, 'connectedCallback', {
        configurable: true,
        writable: true,
        value(this: HTMLElement) {
            replayUpgradedProperties(this)
            original?.call(this)
        },
    })
}

/** One node the element owns: a class to find it by, and the HTML that goes in
 *  it. `html: null` means "this region is not shown right now". */
export interface OwnedNode {
    cls: string
    html: string | null
    /** Tag to create it as. Defaults to `div`. */
    tag?: string
}

/**
 * Rule 1, made mechanical. Create, update and order the element's OWN nodes at the
 * FRONT of the light DOM, leaving every consumer child exactly where the consumer
 * put it. Regions that have to appear after consumer content are ordered with CSS
 * (`order:`), never by moving anything.
 *
 * Idempotent: a node already in the right place is neither re-created nor
 * re-inserted, so changing one attribute does not churn the DOM around a focused
 * control further down.
 */
export function syncOwnedNodes(host: HTMLElement, specs: OwnedNode[]): void {
    let previous: Element | null = null
    for (const spec of specs) {
        const existing = host.querySelector<HTMLElement>(`:scope > .${spec.cls}`)
        if (spec.html == null) {
            existing?.remove()
            continue
        }
        const node = existing ?? document.createElement(spec.tag ?? 'div')
        if (!existing) node.className = spec.cls
        if (node.innerHTML !== spec.html) node.innerHTML = spec.html
        const target: ChildNode | null = previous ? previous.nextSibling : host.firstChild
        if (node !== target) host.insertBefore(node, target)
        previous = node
    }
}

/**
 * The mirror of {@link syncOwnedNodes} for regions that belong AFTER the consumer's
 * content — a required asterisk, a dismiss button, a trailing icon. Appended, in
 * the given order, and again never wrapping anything.
 */
export function syncTrailingNodes(host: HTMLElement, specs: OwnedNode[]): void {
    let next: ChildNode | null = null
    for (let i = specs.length - 1; i >= 0; i--) {
        const spec = specs[i]
        const existing = host.querySelector<HTMLElement>(`:scope > .${spec.cls}`)
        if (spec.html == null) {
            existing?.remove()
            continue
        }
        const node = existing ?? document.createElement(spec.tag ?? 'span')
        if (!existing) node.className = spec.cls
        if (node.innerHTML !== spec.html) node.innerHTML = spec.html
        if (node.parentNode !== host || node.nextSibling !== next) host.insertBefore(node, next)
        next = node
    }
}

/**
 * Base class for new tc-* elements. Encodes rules 1 through 3 structurally:
 * `template()` runs exactly once and is INSERTED, never assigned over the light
 * DOM; `patch()` handles every subsequent change in place; consumer children are
 * never read, moved, or overwritten.
 *
 * Existing components extend HTMLElement directly and are ported over time —
 * `installPropertyReplay` gives them rule 3 in the meantime.
 */
export abstract class TcElement extends HTMLElement {
    private _built = false

    /** Structure the element owns, built exactly once. Must not contain, wrap or
     *  reference consumer children. */
    protected abstract template(): string

    /** In-place update of text, classes and attributes. Runs on every change and
     *  must never replace a node that could contain consumer children. */
    protected abstract patch(): void

    /** Optional one-time wiring, after the template has landed. */
    protected mounted(): void {}

    /** True once `template()` has been inserted — the guard `patch()` helpers use
     *  before reaching for a node the template owns. */
    protected get built(): boolean {
        return this._built
    }

    connectedCallback(): void {
        replayUpgradedProperties(this)
        if (!this._built) {
            // insertAdjacentHTML, never innerHTML: consumer children are already in
            // the light DOM by now and innerHTML would delete them.
            this.insertAdjacentHTML('afterbegin', this.template())
            this._built = true
            this.mounted()
        }
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this._built || !this.isConnected) return
        this.patch()
    }
}
