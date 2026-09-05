// Rule 5, the half that only shows up under React: an element that COPIES the
// consumer's content has to notice when the consumer changes it.
//
// A tc-button takes its `aria-label` from its label text, because the real
// <button> it renders is an empty overlay with no content of its own to be named
// by. A tc-code-snippet copies the code out of its children into the <pre> it
// highlights. Both make that copy inside `render()`, and `render()` runs from
// `attributeChangedCallback` — so the copy is only ever refreshed when one of the
// element's OWN attributes changes.
//
// React changes children without touching attributes. `<tc-button>{label}</…>`
// with a new label rewrites one text node and nothing else, which leaves the
// button announcing the previous label to every screen reader, and leaves a
// snippet showing code that is no longer on screen. Nothing in the app can fix
// it: there is no attribute for the consumer to poke.
//
// observeContent closes that gap. It watches the consumer's content and calls
// back when it really changed — never for the element's own markup, which is what
// keeps a render that rewrites `aria-label` from triggering the next one.
import { isOwned } from './patch-html'

const OBSERVED = new WeakSet<Element>()

/** Did this mutation happen inside markup the element made? */
function isOwnMarkup(host: Element, node: Node | null): boolean {
    for (let n = node; n && n !== host; n = n.parentNode) if (isOwned(n)) return true
    return false
}

/**
 * The consumer's own text inside `host` — what `this.textContent` meant BEFORE
 * the element rendered anything into itself.
 *
 * Plain `textContent` is the wrong source for a derived label the moment the
 * element has any text of its own: a tc-button with `help="Required"` would take
 * "Save Required" as its accessible name, and re-deriving after each render would
 * let the element's own text accumulate into the copy. Only the top level needs
 * filtering — everything under a consumer node is the consumer's too.
 */
export function consumerText(host: Element): string {
    let text = ''
    for (let node = host.firstChild; node; node = node.nextSibling) {
        if (isOwned(node)) continue
        text += node.textContent ?? ''
    }
    return text.trim()
}

/**
 * Call `onChange` whenever the consumer's content inside `host` changes — text
 * edited, children added, removed or reordered.
 *
 * Coalesced to one call per task: react-dom applies a render as a burst of
 * individual DOM operations, and re-deriving after each one would rebuild the
 * element's markup a dozen times for a single state update.
 *
 * Safe to call on every connect; the observer is installed once per element.
 */
export function observeContent(host: Element, onChange: () => void): void {
    if (OBSERVED.has(host)) return
    OBSERVED.add(host)
    let queued = false
    const observer = new MutationObserver((records) => {
        // A mutation the element caused itself is not a change in the consumer's
        // content, and acting on it would be a loop.
        if (!records.some((r) => !isOwnMarkup(host, r.target))) return
        if (queued) return
        queued = true
        queueMicrotask(() => {
            queued = false
            if (host.isConnected) onChange()
        })
    })
    observer.observe(host, { childList: true, subtree: true, characterData: true })
}
