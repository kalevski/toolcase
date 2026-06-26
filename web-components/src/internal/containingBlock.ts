/**
 * Containing-block helpers for `position: fixed` popovers/tooltips that are
 * anchored from viewport coordinates (getBoundingClientRect / pointer coords).
 *
 * A `position: fixed` element is normally laid out against the viewport — but
 * ANY ancestor with a non-`none` `transform`, `perspective`, `filter`,
 * `backdrop-filter`, a `will-change` naming one of those, or a `contain` of
 * `paint`/`layout`/`strict`/`content` becomes the fixed element's containing
 * block instead (CSS positioning spec). When that happens, coordinates derived
 * from getBoundingClientRect() (which are viewport-relative) must be re-based
 * into the containing block's local frame, or the element drifts by the
 * ancestor's offset. This bites e.g. a popover whose ancestor is mid-transition
 * (the tc-modal dialog while it slides in) or any host wrapped in a transformed
 * card/app-shell.
 */

/**
 * Walk up from `start`'s ancestors and return the nearest element that
 * establishes a containing block for `position: fixed` descendants, or null
 * when the element is genuinely viewport-anchored. `start` itself is not
 * considered (callers pass the component host; the positioned popover is a
 * descendant of it).
 */
export function fixedContainingBlock(start: Element | null): HTMLElement | null {
    let el = start?.parentElement ?? null
    while (el && el !== document.documentElement) {
        const s = getComputedStyle(el)
        const backdrop = (s as unknown as { backdropFilter?: string }).backdropFilter ?? 'none'
        if (
            s.transform !== 'none' ||
            s.perspective !== 'none' ||
            s.filter !== 'none' ||
            backdrop !== 'none' ||
            /(transform|perspective|filter)/.test(s.willChange) ||
            /(paint|layout|strict|content)/.test(s.contain)
        ) {
            return el
        }
        el = el.parentElement
    }
    return null
}

/**
 * Viewport-space origin offset to SUBTRACT from getBoundingClientRect()-derived
 * `top`/`left` so a `position: fixed` element stays glued to its anchor even
 * when an ancestor of `start` establishes a containing block. Returns `{x:0,
 * y:0}` for the common viewport-anchored case (no transformed ancestor).
 *
 * Pass `cb` when you already resolved the containing block (e.g. cached on open
 * and re-read each reposition) to avoid re-walking the tree.
 */
export function fixedOriginOffset(
    start: Element | null,
    cb: HTMLElement | null = fixedContainingBlock(start),
): { x: number; y: number } {
    if (!cb) return { x: 0, y: 0 }
    const r = cb.getBoundingClientRect()
    return { x: r.left, y: r.top }
}
