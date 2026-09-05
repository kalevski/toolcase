// Rule 2, made mechanical: build structure once, patch it forever.
//
// `this.innerHTML = html` is the single most common way a tc-* element breaks a
// React app. It deletes every node in the light DOM — including children react-dom
// created and still believes it owns, which makes the next
// `parentInstance.removeChild(child)` throw NotFoundError — and it drops the caret
// out of whatever input was focused inside it.
//
// patchHtml is the drop-in replacement. It parses the same markup the element was
// already producing and reconciles it against what is on the page, so:
//
//   * a node that is still the right tag is REUSED, not replaced — focus, caret,
//     selection, scroll position and any listener bound to it survive;
//   * a node the element did not create is never touched, never moved and never
//     removed (rule 1) — consumer children stay exactly where the consumer put
//     them, and react-dom's parent bookkeeping stays true;
//   * the resulting subtree is byte-for-byte the one `innerHTML = html` produced,
//     so no stylesheet or querySelector in any component had to change.
//
// Ownership is tracked in a WeakMap rather than an attribute: it must not be
// visible to the consumer, serialisable into their markup, or forgeable by it. The
// value is the REGION the node belongs to, so an element that owns markup both
// before and after the consumer's children can patch each half without the other
// half looking like leftovers to be removed.
const OWNED = new WeakMap<Node, string>()

// A bare region label is not enough once a host's markup can CONTAIN another
// tc-* element that renders itself the same way (e.g. an AdvancedTable footer
// embedding <tc-pagination>): both call patchHtml with no region option, so
// both default to the literal string '' — and a leaf's self-made nodes
// (marked '' by ITS OWN patchHtml call, on itself as host) then look, to the
// ancestor's next render, exactly like the ancestor's own stale children of
// region ''. The ancestor's trailing sweep removes them — the leaf renders
// once and goes empty on the ancestor's second pass. Every host that ever
// marks a node is given its own numeric namespace the first time it does, and
// every stored key folds that namespace in, so two different hosts can never
// collide on a region name — including '' — while one host's own region
// stays exactly as stable across its repeated renders as before.
const HOST_NS = new WeakMap<Node, number>()
let nextNs = 1
function namespacedKey(host: Node, region: string): string {
    let ns = HOST_NS.get(host)
    if (ns === undefined) {
        ns = nextNs++
        HOST_NS.set(host, ns)
    }
    return `${ns}:${region}`
}

/** Recursively stamp `node` and its whole subtree with an already-namespaced key. */
function setOwned(node: Node, key: string): void {
    OWNED.set(node, key)
    for (let child = node.firstChild; child; child = child.nextSibling) setOwned(child, key)
}

/** Claim `node` and its whole subtree as owned by `host` (and, optionally, one of
 *  its named regions). Exported for the rare element that creates a node by hand
 *  and then hands the region to patchHtml. */
export function markOwned(node: Node, host: Node, region = ''): void {
    setOwned(node, namespacedKey(host, region))
}

/** Did an element create this node, or did the consumer? */
export function isOwned(node: Node): boolean {
    return OWNED.has(node)
}

export interface PatchOptions {
    /** Name this half of the element's markup when it owns more than one region;
     *  each region is reconciled against its own nodes and ignores the others. */
    region?: string
    /** Where nodes the element has to create go relative to consumer children.
     *  `'start'` (the default) prepends them; `'end'` appends after. */
    at?: 'start' | 'end'
}

/**
 * Reconcile `host`'s owned children with `html`. The replacement for
 * `this.innerHTML = html`.
 *
 * `patchHtml(host, '')` is the replacement for `this.innerHTML = ''` — it removes
 * what the element made and leaves consumer children alone.
 */
// `Node`, not `Element`: a handful of components declare a property that collides
// with one on Element (`after`, `scroll`), which makes `this` structurally
// unassignable to Element even though it is one at runtime.
export function patchHtml(host: Node, html: string, options?: PatchOptions): void {
    // <template> parses table fragments (`<tr>`, `<td>`) and SVG correctly, which
    // a detached <div> does not.
    const template = (host.ownerDocument ?? document).createElement('template')
    template.innerHTML = html
    const key = namespacedKey(host, options?.region ?? '')
    patchChildren(host, template.content, key, options?.at ?? 'start')
}

/** Walk the two child lists together. `cursor` is the position in the live DOM and
 *  only ever advances over nodes the element owns; `anchor` is where a node the
 *  element has to create goes — for `at: 'start'` in front of the consumer's
 *  children, for `at: 'end'` after them. */
function patchChildren(parent: Node, source: Node, region: string, at: 'start' | 'end'): void {
    const mine = (node: Node | null) => !!node && OWNED.get(node) === region
    // Nodes created during THIS pass. They are already in their final position, so
    // they are not candidates for reuse and not leftovers to sweep up. Both matter
    // for `at: 'end'`, where `cursor` sits on the consumer's children and the nodes
    // being created land past it: without this the walk would offer the node it
    // just made as the match for the NEXT template node (a second <div> re-dressing
    // the first), and the trailing sweep would then delete everything the pass had
    // appended — which is how an element ended up with no chrome at all as soon as
    // the consumer put a child inside it.
    const created = new Set<Node>()
    const reusable = (node: Node | null): boolean => mine(node) && !created.has(node as Node)
    /** The region's nodes, in template order, so a mis-ordered reuse can be put back. */
    const placed: Node[] = []
    let cursor = parent.firstChild
    let anchor: Node | null = at === 'end' ? null : parent.firstChild
    for (let next = source.firstChild; next; next = next.nextSibling) {
        // Consumer nodes — and the element's own nodes from another region — are
        // stepped over, not reordered around.
        let owned = cursor
        while (owned && !reusable(owned)) owned = owned.nextSibling
        // The node in this slot may be the wrong kind because the template CHANGED
        // SHAPE — a `split` dropdown growing a second toggle, a variant swapping a
        // <span> for an <a>. Matching strictly by position then creates a duplicate
        // and leaves the original for the trailing sweep, and if the original was
        // the element's container the consumer's children go out with it. So when
        // the slot does not match, the rest of the region is searched for a node
        // that can be re-dressed before anything new is built.
        let match = owned && compatible(owned, next) ? owned : null
        if (!match) {
            for (let scan = owned; scan; scan = scan.nextSibling) {
                if (reusable(scan) && compatible(scan, next)) {
                    match = scan
                    break
                }
            }
            // Everything of this region's skipped to reach the match is genuinely
            // gone from the design — unless it is holding consumer content, which
            // outranks the element's own tidiness (rule 1).
            for (let scan = owned; match && scan && scan !== match;) {
                const after = scan.nextSibling
                if (reusable(scan) && !holdsConsumerContent(scan, region)) parent.removeChild(scan)
                scan = after
            }
        }
        if (match) {
            patchNode(match, next, region)
            placed.push(match)
            cursor = match.nextSibling
            anchor = cursor
        } else {
            const fresh = next.cloneNode(true)
            setOwned(fresh, region)
            created.add(fresh)
            placed.push(fresh)
            parent.insertBefore(fresh, anchor)
        }
    }
    let node = cursor
    // Anything of this region's past the end of the template is gone from the design.
    while (node) {
        const after = node.nextSibling
        if (reusable(node) && !holdsConsumerContent(node, region)) parent.removeChild(node)
        node = after
    }
    // A node that was reused after a sibling had to be created sits behind it —
    // the template's order is the design, so the region is pulled back into line.
    // Only element-owned nodes are ever moved (rule 1), only when they are
    // genuinely out of sequence, and never the first one, whose position is what
    // `at` decided — so a settled render moves nothing and a focused control
    // inside the region is left alone.
    for (let k = 1; k < placed.length; k++) {
        const prev = placed[k - 1]
        if (prev.nextSibling !== placed[k]) parent.insertBefore(placed[k], prev.nextSibling)
    }
}

/**
 * Is anything inside `node` the consumer's?
 *
 * Removing a node the element made is normally free — but an element that has to
 * CONTAIN the consumer's children (a dropdown menu, an accordion body; see
 * adopt-children.ts) keeps them nested inside its own chrome, and dropping that
 * chrome would delete them too. Rule 1 is not just about the nodes a walk steps
 * over directly: a consumer node is off-limits at any depth.
 *
 * A node from ANOTHER region counts as foreign here as well — it belongs to a
 * different half of the element's markup and this pass has no say over it.
 */
function holdsConsumerContent(node: Node, region: string): boolean {
    for (let child = node.firstChild; child; child = child.nextSibling) {
        const owner = OWNED.get(child)
        if (owner === undefined || owner !== region) return true
        if (holdsConsumerContent(child, region)) return true
    }
    return false
}

/** Reusable means "same kind of node in the same namespace" — a `<span>` may be
 *  re-dressed into another `<span>`, never into a `<div>`. */
function compatible(a: Node, b: Node): boolean {
    if (a.nodeType !== b.nodeType) return false
    if (a.nodeType !== Node.ELEMENT_NODE) return true
    const ea = a as Element
    const eb = b as Element
    return ea.tagName === eb.tagName && ea.namespaceURI === eb.namespaceURI
}

function patchNode(node: Node, source: Node, region: string): void {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        if (node.nodeValue !== source.nodeValue) node.nodeValue = source.nodeValue
        return
    }
    const el = node as Element
    const src = source as Element
    syncAttributes(el, src)
    if (el.tagName === 'TEXTAREA') {
        syncFormState(el, src)
        return
    }
    patchChildren(el, src, region, 'start')
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') syncFormState(el, src)
}

function syncAttributes(el: Element, src: Element): void {
    for (const attr of Array.from(src.attributes)) {
        if (el.getAttributeNS(attr.namespaceURI, attr.localName) === attr.value) continue
        if (attr.namespaceURI) el.setAttributeNS(attr.namespaceURI, attr.name, attr.value)
        else el.setAttribute(attr.name, attr.value)
    }
    for (const attr of Array.from(el.attributes)) {
        if (src.hasAttributeNS(attr.namespaceURI, attr.localName)) continue
        el.removeAttributeNS(attr.namespaceURI, attr.localName)
    }
}

/**
 * A reused form control keeps its VALUE PROPERTY, and after the user has typed,
 * the property no longer tracks the attribute — so the attribute sync above is not
 * enough to push a new value in, and blindly pushing one would fight the person
 * typing. The rule: the element wins, unless the control has focus, in which case
 * the person does.
 */
function syncFormState(el: Element, src: Element): void {
    if (el.ownerDocument.activeElement === el) return
    if (el.tagName === 'SELECT') {
        const select = el as HTMLSelectElement
        const selected = src.querySelector('option[selected]')
        const value =
            src.getAttribute('value') ?? selected?.getAttribute('value') ?? selected?.textContent
        if (value != null && select.value !== value) select.value = value
        return
    }
    if (el.tagName === 'TEXTAREA') {
        const area = el as HTMLTextAreaElement
        const text = src.textContent ?? ''
        if (area.value !== text) area.value = text
        return
    }
    const input = el as HTMLInputElement
    if (input.type === 'checkbox' || input.type === 'radio') {
        const checked = src.hasAttribute('checked')
        if (input.checked !== checked) input.checked = checked
        return
    }
    const value = src.getAttribute('value')
    if (value != null && input.value !== value) input.value = value
}

const BOUND = new WeakMap<EventTarget, Map<string, EventListener>>()

/**
 * The companion to node reuse. An element that binds a listener from inside its
 * render function used to be safe by accident: `innerHTML =` threw the old node
 * away, and the listener with it. patchHtml keeps the node, so a second
 * `addEventListener` would fire the handler twice.
 *
 * bindOnce replaces the listener this node already has for `type` instead of
 * stacking another one — so a fresh closure (which is usually the point: it has
 * captured this render's state) still wins, and the handler still runs exactly
 * once per event. Pass `key` when one node legitimately needs two listeners of
 * the same type.
 */
export function bindOnce<E extends Event = Event>(
    // EventTarget, not Node: the same de-duplication is worth having on a
    // MediaQueryList or a WakeLockSentinel, and those are not nodes.
    node: EventTarget | null | undefined,
    type: string,
    // Generic in the event, the way addEventListener's overloads are: a handler
    // written `(e: KeyboardEvent) => …` has to port over without a cast.
    listener: (event: E) => void,
    options?: AddEventListenerOptions & { key?: string },
): void {
    // Null-tolerant so `el?.addEventListener(...)` ports across unchanged.
    if (!node) return
    const slot = `${type}:${options?.key ?? ''}`
    let bound = BOUND.get(node)
    if (!bound) BOUND.set(node, (bound = new Map()))
    const handler = listener as EventListener
    const previous = bound.get(slot)
    if (previous) node.removeEventListener(type, previous, options)
    bound.set(slot, handler)
    node.addEventListener(type, handler, options)
}
