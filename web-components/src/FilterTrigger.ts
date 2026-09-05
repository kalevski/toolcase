import { setHostClass } from './internal/host-class'
import { num, setAttr, syncOwnedNodes, syncTrailingNodes } from './internal/tc-element'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { msg } from './messages'

// tc-filter-trigger — the one control that opens a filter sheet, with an
// active-count marker.
//
// From polovni.mk, where six pages had drawn this button byte for byte, each
// reaching into the home page's stylesheet for its class. A shared shape ends up
// owned by whichever feature happened to draw it first; this is that shape with
// its own class.
//
// THE COUNT IS THE POINT. A filter button that does not say how many filters are
// set is a button that makes the reader open the sheet to find out — which is the
// one thing the trigger exists to save them. Zero draws the plain button; any
// other number marks it and shows the figure.
//
// THE HOST IS THE BUTTON: `role="button"` plus Enter/Space rather than an inner
// `<button>`, so the label you pass stays a direct child. A trigger's label is
// routinely `{t.filters} {count > 0 && `(${count})`}` — two children, and the
// second disappearing is exactly the individual removal that makes react-dom
// throw NotFoundError against a re-parenting element.

const TAG_NAME = 'tc-filter-trigger'

export class FilterTrigger extends HTMLElement {
    private _built = false

    /** Invoked on activation. The `tc-open` event is the primary API. */
    onOpen: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['count', 'label', 'icon', 'disabled', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** How many of the sheet's own controls are set. Zero is the plain trigger. */
    get count(): number {
        return Math.max(0, Math.round(num(this.getAttribute('count'), 0)))
    }
    set count(v: number) {
        this.setAttribute('count', String(v))
    }

    /** The button's text. Also its accessible name when no children are passed. */
    get label(): string {
        return this.getAttribute('label') ?? msg('filtersLabel')
    }
    set label(v: string) {
        setAttr(this, 'label', v)
    }

    get icon(): string {
        return this.getAttribute('icon') ?? 'SlidersHorizontal'
    }
    set icon(v: string) {
        setAttr(this, 'icon', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private patch(): void {
        const count = this.count
        setHostClass(this, 'tc-filter-trigger')
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        this.setAttribute('tabindex', this.disabled ? '-1' : '0')
        if (this.disabled) this.setAttribute('aria-disabled', 'true')
        else this.removeAttribute('aria-disabled')
        if (count > 0) this.setAttribute('data-active', '')
        else this.removeAttribute('data-active')

        // Icon before the label, count after it — the reading order, and the only
        // order that needs no CSS to arrange.
        syncOwnedNodes(this, [
            { cls: 'tc-filter-trigger__icon', tag: 'span', html: lucideByName(this.icon) },
            {
                cls: 'tc-filter-trigger__label',
                tag: 'span',
                // Only rendered when the consumer passed no children of their own:
                // a label is either an attribute or a child, never both.
                html: this._hasOwnLabel() ? null : esc(this.label),
            },
        ])
        // Appended: the count belongs after whatever the label is, and the label
        // may be a consumer child this element must not move.
        syncTrailingNodes(this, [
            {
                cls: 'tc-filter-trigger__count',
                tag: 'span',
                html: count > 0 ? String(count) : null,
            },
        ])
    }

    /**
     * True when the consumer passed their own label as children.
     *
     * A sibling walk rather than `Array.from(this.childNodes)`: this element must
     * never be able to move a consumer node, and not materialising the list is the
     * cheapest way to keep that true by construction.
     */
    private _hasOwnLabel(): boolean {
        for (let node = this.firstChild; node !== null; node = node.nextSibling) {
            if (node instanceof Element && node.className.startsWith('tc-filter-trigger__'))
                continue
            if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() === '') continue
            return true
        }
        return false
    }

    private _activate(): void {
        if (this.disabled) return
        this.dispatchEvent(new CustomEvent('tc-open', { bubbles: true, composed: true }))
        if (typeof this.onOpen === 'function') this.onOpen()
    }

    private _onClick = (): void => {
        this._activate()
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (event.target !== this) return
        event.preventDefault()
        this._activate()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FilterTrigger
    }
}
