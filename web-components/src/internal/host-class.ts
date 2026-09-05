// Host-class merge for components that own their host `class` attribute.
//
// Several components (tc-badge, tc-alert, tc-card, tc-modal, …) own the host's
// `class` attribute, which means assigning `this.className` wholesale would wipe
// whatever the consumer authored on the tag — the classic React gotcha where
// `className` on a tc-* element "does nothing" because the first render clobbers
// it. This helper keeps the two sets apart: it remembers what the COMPONENT wrote
// and treats everything else currently on the host as the consumer's, so the merge
// is correct in both directions and stays correct when react-dom later rewrites
// `className` behind the element's back.

// Structural host type: Offcanvas overrides `scroll` with a boolean attribute
// prop, so it is not assignable to Element/HTMLElement — className + classList
// are all this helper needs.
type ClassHost = { className: string; classList: DOMTokenList }

// What the COMPONENT last wrote. Everything else on the host is the consumer's,
// re-read on every call rather than snapshotted once — React rewrites `className`
// wholesale whenever its value changes, so a one-time snapshot would keep
// resurrecting the class the consumer had at mount and lose the one they have now.
const APPLIED = new WeakMap<ClassHost, string[]>()

/**
 * Replace the host's class list with `classes`, preserving whatever the consumer
 * authored on the tag. Use instead of `this.className = …`.
 *
 * Re-running it after React has overwritten `className` restores the component's
 * classes and keeps React's new ones, which is why the elements that own their
 * host class observe `class` and call this from their patch: react-dom writes the
 * attribute directly and never asks the element first.
 *
 * The write is guarded on the value actually changing, so calling this from an
 * `attributeChangedCallback` for `class` settles after one pass instead of looping.
 */
export function setHostClass(host: ClassHost, classes: string): void {
    const applied = APPLIED.get(host) ?? []
    const authored = Array.from(host.classList).filter((c) => !applied.includes(c))
    const own = classes.split(/\s+/).filter(Boolean)
    // Set dedupes while preserving insertion order: component classes first,
    // then any consumer-authored classes not already present.
    const merged = [...new Set([...own, ...authored])]
    APPLIED.set(host, own)
    const value = merged.join(' ')
    if (host.className !== value) host.className = value
}
