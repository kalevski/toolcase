import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

// tc-bead-trail — a breadcrumb that shows DEPTH as beads and the path as names.
//
// From mindmap's recent-cards trail. A chevron breadcrumb answers "where is
// this", but only if the whole path fits — and in a tree that goes six deep it
// never does, so every implementation elides the middle and the reader loses the
// one fact they wanted: how far down this thing lives.
//
// The beads answer that first. One bead per level, the last one marked, so
// "third of six" is legible before a single name is read; then the names follow,
// elided in the middle when they have to be. Depth is a shape, not a count of
// visible crumbs.
//
// TWO CRUMB ELEMENTS IN THIS LIBRARY:
//   tc-breadcrumb   the page's own path — a NAVIGATION landmark, every crumb a
//                   link, and the reader is standing on the last one.
//   tc-bead-trail   this one. Says where a thing in a LIST lives, for a reader
//                   standing somewhere else entirely. It is not navigation
//                   furniture, so it is not a `nav` unless the crumbs are links.
//
// Beyond `max-crumbs` the middle is replaced by one ellipsis and the FIRST and
// LAST crumbs are kept — the root says which tree, the parent says which branch,
// and the levels in between are what the beads already covered.

const TAG_NAME = 'tc-bead-trail'

export interface BeadTrailCrumb {
    id: string
    label: string
    /** Makes the crumb a link. Without it the crumb is plain text. */
    href?: string
}

export class BeadTrail extends HTMLElement {
    private _built = false
    private _crumbs: BeadTrailCrumb[] = []
    private _root: HTMLElement | null = null

    static get observedAttributes(): string[] {
        return ['max-crumbs', 'max-beads', 'root-label', 'separator', 'class']
    }

    connectedCallback(): void {
        if (!this._built) {
            this.insertAdjacentHTML(
                'afterbegin',
                `<span class="tc-bead-trail__beads" aria-hidden="true"></span>` +
                    `<span class="tc-bead-trail__path"></span>`,
            )
            this._root = this.querySelector(':scope > .tc-bead-trail__path')
            this._built = true
        }
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** The path from the root down to (but not including) the thing itself. */
    get crumbs(): BeadTrailCrumb[] {
        return this._crumbs
    }
    set crumbs(v: BeadTrailCrumb[]) {
        this._crumbs = Array.isArray(v) ? v : []
        if (this._built) this.patch()
    }

    /** How many names are drawn before the middle is elided. */
    get maxCrumbs(): number {
        const raw = Number(this.getAttribute('max-crumbs'))
        return Number.isFinite(raw) && raw >= 2 ? raw : 3
    }
    set maxCrumbs(v: number) {
        this.setAttribute('max-crumbs', String(v))
    }

    /** How many beads are drawn before the trail is marked as deeper still. */
    get maxBeads(): number {
        const raw = Number(this.getAttribute('max-beads'))
        return Number.isFinite(raw) && raw >= 2 ? raw : 6
    }
    set maxBeads(v: number) {
        this.setAttribute('max-beads', String(v))
    }

    /** What an empty trail says — "at the root". */
    get rootLabel(): string | null {
        return this.getAttribute('root-label')
    }
    set rootLabel(v: string | null) {
        if (v != null) this.setAttribute('root-label', v)
        else this.removeAttribute('root-label')
    }

    get separator(): string {
        return this.getAttribute('separator') ?? '/'
    }
    set separator(v: string) {
        setAttr(this, 'separator', v)
    }

    private patch(): void {
        setHostClass(this, 'tc-bead-trail')
        this._renderBeads()
        this._renderPath()
    }

    private _renderBeads(): void {
        const beads = this.querySelector<HTMLElement>(':scope > .tc-bead-trail__beads')
        if (!beads) return
        const depth = this._crumbs.length
        const cap = this.maxBeads
        const shown = Math.min(depth + 1, cap)
        const deeper = depth + 1 > cap
        const html = Array.from({ length: shown }, (_, index) => {
            // The LAST bead is the thing itself, which is what makes the row read as
            // "here, at this depth" rather than as a count of ancestors.
            const kind = index === shown - 1 ? 'here' : 'step'
            return `<span class="tc-bead-trail__bead tc-bead-trail__bead--${kind}"></span>`
        }).join('')
        if (beads.innerHTML !== html) beads.innerHTML = html
        beads.classList.toggle('tc-bead-trail__beads--deeper', deeper)
    }

    private _renderPath(): void {
        const path = this._root
        if (!path) return
        const crumbs = this._crumbs
        const separator = `<span class="tc-bead-trail__sep" aria-hidden="true">${esc(this.separator)}</span>`

        if (crumbs.length === 0) {
            const label = this.rootLabel
            const html = label ? `<span class="tc-bead-trail__root">${esc(label)}</span>` : ''
            if (path.innerHTML !== html) path.innerHTML = html
            return
        }

        const cap = this.maxCrumbs
        // First and last kept. The root says which tree, the parent says which
        // branch, and the levels between are what the beads already carried.
        const shown: Array<BeadTrailCrumb | null> =
            crumbs.length <= cap
                ? crumbs
                : [crumbs[0], null, ...crumbs.slice(crumbs.length - (cap - 1))]

        const html = shown
            .map((crumb, index) => {
                const lead = index > 0 ? separator : ''
                if (crumb === null) {
                    return `${lead}<span class="tc-bead-trail__gap" aria-hidden="true">…</span>`
                }
                const body = esc(crumb.label)
                return crumb.href
                    ? `${lead}<a class="tc-bead-trail__crumb" href="${esc(crumb.href)}">${body}</a>`
                    : `${lead}<span class="tc-bead-trail__crumb">${body}</span>`
            })
            .join('')
        if (path.innerHTML !== html) path.innerHTML = html
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BeadTrail
    }
}
