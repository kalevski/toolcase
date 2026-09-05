// Rule 4 for the values that reach a browser API rather than an attribute.
//
// `bool`, `num` and `str` in tc-element.ts coerce what a consumer writes into
// something the ELEMENT can use. These do the same job one step further out, for
// the handful of platform calls that throw a DOMException when handed a value they
// do not like. React makes that easy to hit without meaning to: it stringifies
// whatever a prop was, so `cols={{}}` arrives as `'[object Object]'`, `min={-1}`
// as `'-1'`, and a mistyped selector arrives exactly as typed. Each of those
// used to escape as an uncaught error from inside a lifecycle callback, which
// react-dom cannot catch and which therefore takes the app down rather than the
// component.
//
// The rule these encode: a consumer value never reaches a throwing API unchecked.
// The component falls back to its default and keeps rendering.

/**
 * `root.querySelector(selector)` for a selector the CONSUMER wrote.
 *
 * `querySelector` throws SyntaxError on anything that is not a valid selector —
 * `'1'`, `'#2fa'`, an empty string — so a `target="…"` typo would otherwise take
 * out the whole render rather than simply matching nothing.
 */
export function queryOne<E extends Element = Element>(
    root: Document | Element,
    selector: string | null | undefined,
): E | null {
    if (!selector) return null
    try {
        return root.querySelector<E>(selector)
    } catch {
        return null
    }
}

/** `root.querySelectorAll(selector)` for a consumer-written selector. See {@link queryOne}. */
export function queryAll<E extends Element = Element>(
    root: Document | Element,
    selector: string | null | undefined,
): E[] {
    if (!selector) return []
    try {
        return Array.from(root.querySelectorAll<E>(selector))
    } catch {
        return []
    }
}

// One to four <length-percentage> components, the grammar IntersectionObserver's
// rootMargin accepts. A bare number is NOT valid there ('0' included), which is
// exactly the value a React author passes when they think in pixels.
const ROOT_MARGIN = /^\s*(-?\d+(\.\d+)?(px|%)\s*){1,4}$/

/**
 * A `rootMargin` IntersectionObserver will accept, or `fallback`.
 *
 * The constructor throws SyntaxError unless every component carries a unit, and it
 * throws from wherever the observer is built — a `connectedCallback`, usually,
 * where the error is uncatchable by the consumer.
 */
export function rootMargin(value: string | null | undefined, fallback: string): string {
    if (!value) return fallback
    return ROOT_MARGIN.test(value) ? value : fallback
}

/**
 * Class tokens `DOMTokenList` will accept, from values that were interpolated
 * into them.
 *
 * `classList.add('')` throws SyntaxError and `classList.add('a b')` throws
 * InvalidCharacterError, so a single `variant={{}}` — `'align-items-[object
 * Object]'` by the time it is a token — used to abort the whole render. Splitting
 * on whitespace and dropping the empties is what `class="…"` does anyway.
 */
export function classTokens(...values: (string | null | undefined)[]): string[] {
    const tokens: string[] = []
    for (const value of values) {
        if (!value) continue
        for (const token of value.split(/\s+/)) if (token) tokens.push(token)
    }
    return tokens
}

/**
 * A URL for an image source that may be a URL string, a Blob/File, or — because a
 * consumer types what they type — neither.
 *
 * `URL.createObjectURL` throws TypeError on anything that is not a Blob or
 * MediaSource, from inside a property setter, which is the one place a React app
 * cannot recover from it.
 *
 * @returns the URL plus whether the caller has to revoke it, or `null` when the
 *   source is not something that can be loaded at all.
 */
export function sourceUrl(
    source: unknown,
): { url: string; revoke: boolean } | null {
    if (typeof source === 'string') return source === '' ? null : { url: source, revoke: false }
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
        return { url: URL.createObjectURL(source), revoke: true }
    }
    return null
}
