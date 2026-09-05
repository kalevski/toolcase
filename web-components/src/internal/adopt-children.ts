// Rule 1 — never move a consumer node — has one class of exception that light
// DOM cannot design away: an element whose own chrome has to CONTAIN the
// consumer's children.
//
// A dropdown menu is one absolutely-positioned box, an accordion body is one
// collapsible box, a carousel slide wraps exactly one child, a row belongs to a
// <tbody>. There is no <slot> to project into without a shadow root, and no CSS
// that puts N sibling nodes inside a box they are not in — `display: contents`,
// grid placement and absolute positioning all need the nodes to already be
// children of the box. So those elements adopt: on first connect they move the
// consumer's children into the container.
//
// That is where React breaks. react-dom recorded the HOST as the parent of every
// node it created there, and on the next render it calls
// `host.removeChild(node)` / `host.insertBefore(node, ref)` against a node that
// now lives one level deeper. The DOM throws NotFoundError, react-dom has no
// catch around it, and the whole tree unmounts — a blank route from a component
// that merely re-rendered.
//
// adoptChildren makes the host answer for its adopted children instead. The
// three mutation methods react-dom calls on a parent it owns are forwarded to
// wherever the child actually went, so the host behaves as if nothing moved.
// Nodes the element created itself are left on the native path (patchHtml marks
// them), so an element's own render is untouched — which is what keeps this
// separate from rule 2 rather than a hole in it.
import { isOwned } from './patch-html'

/**
 * Where a consumer node belongs. Called with the node — so an element with more
 * than one container can route by `slot`, tag name or type — and with the
 * sibling react-dom wants it placed before, which is what lets an element that
 * gives every child its OWN container (a carousel slide) build that container in
 * the right position. Return `null` to leave the node a direct child of the host.
 */
export type AdoptRoute = (node: Node, before: Node | null) => Node | null

const ROUTE = new WeakMap<Node, AdoptRoute>()
const INSTALLED = new WeakSet<Node>()

/** The container a consumer node should be in, or null to leave it alone. */
function routeFor(host: Node, node: Node, before: Node | null = null): Node | null {
    // The element's own markup is never re-homed: patchHtml inserts and removes
    // it through these same methods, and forwarding those would file the
    // element's chrome inside its own container.
    if (isOwned(node)) return null
    const target = ROUTE.get(host)?.(node, before) ?? null
    return target && target !== host && host.contains(target) ? target : null
}

/** Is `node` an adopted child — inside the host, but not a direct child of it? */
function isAdopted(host: Node, node: Node): boolean {
    const parent = node.parentNode
    return !!parent && parent !== host && !isOwned(node) && host.contains(parent)
}

function appendChild<T extends Node>(this: Node, node: T): T {
    const target = routeFor(this, node)
    return Node.prototype.appendChild.call(target ?? this, node) as T
}

function insertBefore<T extends Node>(this: Node, node: T, ref: Node | null): T {
    const target = routeFor(this, node, ref)
    if (target) {
        // The anchor positions the node only when the two end up in the same
        // container: an element that gives each child its own box has already
        // placed that box, so appending into it is the correct answer there.
        if (ref && ref.parentNode === target)
            return Node.prototype.insertBefore.call(target, node, ref) as T
        return Node.prototype.appendChild.call(target, node) as T
    }
    // The route declined, but the anchor has been adopted — the native call would
    // throw where the node plainly belongs beside the sibling it was given.
    if (ref && !isOwned(node) && isAdopted(this, ref))
        return Node.prototype.insertBefore.call(ref.parentNode!, node, ref) as T
    return Node.prototype.insertBefore.call(this, node, ref) as T
}

function removeChild<T extends Node>(this: Node, node: T): T {
    if (isAdopted(this, node)) return Node.prototype.removeChild.call(node.parentNode!, node) as T
    return Node.prototype.removeChild.call(this, node) as T
}

/**
 * Adopt `nodes` into the container `route` names, and make `host` answer for
 * them afterwards.
 *
 * Call it with the consumer's children captured before the element rendered.
 * Calling it again re-points the route (an element that re-renders its container
 * hands over the new one) and re-homes anything that has since arrived as a
 * direct child — which is what makes a plain `host.append(...)` from
 * non-React code land in the right place too.
 */
export function adoptChildren(host: Element, route: AdoptRoute, nodes?: Iterable<Node>): void {
    ROUTE.set(host, route)
    if (!INSTALLED.has(host)) {
        INSTALLED.add(host)
        // Own properties on the instance, not the prototype: the override has to
        // shadow Node.prototype for this host only, and stay invisible to any
        // element that never adopts.
        Object.defineProperties(host, {
            appendChild: { value: appendChild, configurable: true, writable: true },
            insertBefore: { value: insertBefore, configurable: true, writable: true },
            removeChild: { value: removeChild, configurable: true, writable: true },
        })
    }
    for (const node of nodes ?? Array.from(host.childNodes)) {
        const target = routeFor(host, node)
        if (target && node.parentNode !== target) Node.prototype.appendChild.call(target, node)
    }
}

/**
 * The consumer's children, in order, wherever they currently are — the list an
 * adopting element needs when it has to rebuild its container and put them back.
 * Excludes the element's own markup.
 */
export function adoptedChildren(host: Element): Node[] {
    const found: Node[] = []
    const walk = (parent: Node): void => {
        for (let node = parent.firstChild; node; node = node.nextSibling) {
            if (isOwned(node)) walk(node)
            else found.push(node)
        }
    }
    walk(host)
    return found
}
