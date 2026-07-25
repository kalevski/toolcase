// Host-class merge for components that own their host `class` attribute.
//
// Several components (tc-modal, tc-alert, tc-card, …) assign `this.className`
// wholesale during render, which silently wipes any classes the consumer
// authored on the tag — the classic React gotcha where `className` on a tc-*
// element "does nothing" because the first render clobbers it. This helper
// snapshots the consumer-authored classes on first use (before the component
// has added anything) and re-merges them into every subsequent assignment.

// Structural host type: Offcanvas overrides `scroll` with a boolean attribute
// prop, so it is not assignable to Element/HTMLElement — className + classList
// are all this helper needs.
type ClassHost = { className: string; classList: DOMTokenList }

const AUTHORED = new WeakMap<ClassHost, string[]>()

/** Replace the host's class list with `classes` + the consumer-authored
 *  classes captured on first call. Use instead of `this.className = …`. */
export function setHostClass(host: ClassHost, classes: string): void {
    let authored = AUTHORED.get(host)
    if (!authored) {
        // First call happens during the first render, before the component has
        // written any classes — everything present was authored by the consumer.
        authored = Array.from(host.classList)
        AUTHORED.set(host, authored)
    }
    // Set dedupes while preserving insertion order: component classes first,
    // then any consumer-authored classes not already present.
    const merged = new Set<string>()
    for (const c of classes.split(/\s+/)) {
        if (c) merged.add(c)
    }
    for (const c of authored) {
        merged.add(c)
    }
    host.className = [...merged].join(' ')
}
