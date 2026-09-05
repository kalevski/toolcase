import { setHostClass } from './internal/host-class'
import { num, setAttr, syncOwnedNodes } from './internal/tc-element'
import { esc } from './internal/esc'

// tc-floating-action-bar — the selection bar that floats over a list and stays
// lined up with the column it belongs to.
//
// Identical in polovni.mk, webgame.cloud and mindmap, all three measuring an
// anchor element and copying its `left`/`width` onto a fixed bar. `position:
// fixed` is what the shape requires — the bar has to clear the app's own bottom
// chrome (a dock, an action bar, the safe-area inset), and a sticky box cannot
// leave its scrollport — but a fixed box has left the column, so its horizontal
// geometry has to be measured back.
//
// THE HOST IS THE BAR, and what it measures is its own PARENT. All three apps
// rendered an in-flow anchor div next to the fixed bar and measured that; the
// anchor is unnecessary, because the host already sits where the consumer put it
// and its parent's box IS the column. Dropping it also drops the question the
// anchor created — how do the consumer's actions get inside a box that is not
// their parent — which has only one answer that does not move their nodes.
//
// So the actions stay direct children of the host and the host lays them out.
// The only node this element creates is the count line, which is PREPENDED.
//
// While it is shown it publishes its own height plus a clearance as
// `--tc-action-bar-clearance` on the document root, which is what all three apps
// used to keep the list's last row reachable above the bar. Removed when it
// hides, so a page that never shows one pays nothing.
//
// `open` is reflected, never self-cleared: this element has no close path of its
// own. What clears a selection bar is the selection going away, and only the
// consumer knows that.

const TAG_NAME = 'tc-floating-action-bar'

/** Breathing room kept between the bar and whatever the list's last row is. */
const DEFAULT_CLEARANCE = 32

const CLEARANCE_VAR = '--tc-action-bar-clearance'

export type FloatingActionBarAlign = 'column' | 'viewport'

export class FloatingActionBar extends HTMLElement {
    private _built = false
    private _observer: ResizeObserver | null = null
    private _frame = 0

    static get observedAttributes(): string[] {
        return ['open', 'label', 'clearance', 'align', 'class']
    }

    connectedCallback(): void {
        this._built = true
        if (!this.hasAttribute('role')) this.setAttribute('role', 'toolbar')
        this._observe()
        window.addEventListener('resize', this._measure)
        this.patch()
    }

    disconnectedCallback(): void {
        this._observer?.disconnect()
        this._observer = null
        window.removeEventListener('resize', this._measure)
        if (this._frame) cancelAnimationFrame(this._frame)
        this._frame = 0
        this._releaseClearance()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** Shown. Reflected only — see the note about self-clearing above. */
    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    /** The count line — "3 selected". Rendered before your actions. */
    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    /** Pixels of breathing room published above the bar. */
    get clearance(): number {
        return num(this.getAttribute('clearance'), DEFAULT_CLEARANCE)
    }
    set clearance(v: number) {
        this.setAttribute('clearance', String(v))
    }

    /** `column` (default) matches the parent's box; `viewport` spans the window. */
    get align(): FloatingActionBarAlign {
        return this.getAttribute('align') === 'viewport' ? 'viewport' : 'column'
    }
    set align(v: FloatingActionBarAlign) {
        setAttr(this, 'align', v)
    }

    private patch(): void {
        setHostClass(this, 'tc-floating-action-bar')
        this.setAttribute('data-open', this.open ? 'true' : 'false')
        // `aria-hidden` and not `hidden`: the bar has to keep its box while closed
        // so the exit transition has something to animate, and so its height can be
        // measured the moment it opens.
        if (this.open) this.removeAttribute('aria-hidden')
        else this.setAttribute('aria-hidden', 'true')

        const label = this.label
        syncOwnedNodes(this, [
            {
                cls: 'tc-floating-action-bar__label',
                tag: 'span',
                html: label ? esc(label) : null,
            },
        ])
        this._measure()
    }

    private _observe(): void {
        if (this._observer || typeof ResizeObserver === 'undefined') return
        this._observer = new ResizeObserver(() => this._measure())
        this._observer.observe(this)
        if (this.parentElement) this._observer.observe(this.parentElement)
    }

    // rAF-coalesced. A ResizeObserver on both the host and its parent fires twice
    // for one layout change, and writing geometry inside the observer callback is
    // exactly what makes a ResizeObserver loop.
    private _measure = (): void => {
        if (this._frame) return
        this._frame = requestAnimationFrame(() => {
            this._frame = 0
            this._apply()
        })
    }

    private _apply(): void {
        if (!this.isConnected) return
        const column = this.parentElement
        if (this.align === 'column' && column) {
            const box = column.getBoundingClientRect()
            const style = getComputedStyle(column)
            // Inside the parent's PADDING box, not its border box — a bar flush with
            // the edge of a padded card is the one thing a measured bar exists to
            // avoid.
            const left = box.left + parseFloat(style.paddingLeft || '0')
            const right = box.right - parseFloat(style.paddingRight || '0')
            this.style.left = `${Math.round(left)}px`
            this.style.width = `${Math.round(Math.max(0, right - left))}px`
        } else {
            this.style.removeProperty('left')
            this.style.removeProperty('width')
        }

        if (!this.open) {
            this._releaseClearance()
            return
        }
        const height = Math.ceil(this.getBoundingClientRect().height)
        if (height <= 0) return
        this.ownerDocument?.documentElement.style.setProperty(
            CLEARANCE_VAR,
            `${height + this.clearance}px`,
        )
    }

    private _releaseClearance(): void {
        this.ownerDocument?.documentElement.style.removeProperty(CLEARANCE_VAR)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FloatingActionBar
    }
}
