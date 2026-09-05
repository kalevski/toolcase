import { setHostClass } from './internal/host-class'
import { num, setAttr, syncOwnedNodes } from './internal/tc-element'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

// tc-zoom-control — minus, the percentage, plus, and "fit".
//
// `EditorZoom` in webgame.cloud and mindmap, identical. It is small enough that
// duplicating it looks harmless, which is exactly why both apps did — and both
// then had to keep the same four decisions in step: that the figure shown is
// `fit × zoom` and not `zoom`, that it is rounded to whole percent, that "fit" is
// a word rather than a third glyph, and that the steps come from a ladder rather
// than a multiplier.
//
// It drives a `tc-design-canvas` by id (`for`), or emits and lets you drive
// whatever you have. Bound to a canvas it needs no wiring at all, which is the
// case both apps were writing by hand.

const TAG_NAME = 'tc-zoom-control'

interface ZoomTarget extends HTMLElement {
    zoom: number
    fit: number
    stepZoom(direction: number): void
    fitToView(): void
}

export class ZoomControl extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        return ['for', 'zoom', 'fit', 'fit-label', 'zoom-in-label', 'zoom-out-label', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.addEventListener('click', this._onClick)
        // The canvas is the source of truth while one is bound, so the display
        // follows its event rather than being pushed by the consumer. Captured at
        // the document, because the control is routinely in a status bar that is
        // not an ancestor of the canvas.
        this.ownerDocument?.addEventListener('tc-zoom', this._onCanvasZoom, true)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.ownerDocument?.removeEventListener('tc-zoom', this._onCanvasZoom, true)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** The id of the `tc-design-canvas` this drives. Absent emits only. */
    get htmlFor(): string | null {
        return this.getAttribute('for')
    }
    set htmlFor(v: string | null) {
        if (v != null) this.setAttribute('for', v)
        else this.removeAttribute('for')
    }

    /** The reader's zoom. Mirrored from the canvas when one is bound. */
    get zoom(): number {
        return num(this.getAttribute('zoom'), 1)
    }
    set zoom(v: number) {
        this.setAttribute('zoom', String(v))
    }

    /** The canvas's fit scale. The figure shown is `fit × zoom`. */
    get fit(): number {
        return num(this.getAttribute('fit'), 1)
    }
    set fit(v: number) {
        this.setAttribute('fit', String(v))
    }

    get fitLabel(): string {
        return this.getAttribute('fit-label') ?? 'Fit'
    }
    set fitLabel(v: string) {
        setAttr(this, 'fit-label', v)
    }

    get zoomInLabel(): string {
        return this.getAttribute('zoom-in-label') ?? 'Zoom in'
    }
    set zoomInLabel(v: string) {
        setAttr(this, 'zoom-in-label', v)
    }

    get zoomOutLabel(): string {
        return this.getAttribute('zoom-out-label') ?? 'Zoom out'
    }
    set zoomOutLabel(v: string) {
        setAttr(this, 'zoom-out-label', v)
    }

    private _target(): ZoomTarget | null {
        const id = this.htmlFor
        if (!id) return null
        const node = this.ownerDocument?.getElementById(id)
        return node && 'stepZoom' in node ? (node as ZoomTarget) : null
    }

    private patch(): void {
        setHostClass(this, 'tc-zoom-control')
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        // Rounded to whole percent: a canvas at 33.333% is at a third, and the two
        // extra digits are noise on a control read at a glance.
        const shown = `${Math.round(this.fit * this.zoom * 100)}%`
        syncOwnedNodes(this, [
            { cls: 'tc-zoom-control__out', tag: 'button', html: lucideByName('Minus') },
            { cls: 'tc-zoom-control__value', tag: 'span', html: esc(shown) },
            { cls: 'tc-zoom-control__in', tag: 'button', html: lucideByName('Plus') },
            { cls: 'tc-zoom-control__fit', tag: 'button', html: esc(this.fitLabel) },
        ])
        const labels: Array<[string, string]> = [
            ['.tc-zoom-control__out', this.zoomOutLabel],
            ['.tc-zoom-control__in', this.zoomInLabel],
            ['.tc-zoom-control__fit', this.fitLabel],
        ]
        for (const [selector, label] of labels) {
            const button = this.querySelector<HTMLButtonElement>(`:scope > ${selector}`)
            if (!button) continue
            button.type = 'button'
            button.setAttribute('aria-label', label)
        }
        const value = this.querySelector<HTMLElement>(':scope > .tc-zoom-control__value')
        // `status`, not `alert`: the figure changes constantly while a reader zooms,
        // and an assertive live region would interrupt them on every step.
        if (value) value.setAttribute('role', 'status')
    }

    private _apply(action: 'in' | 'out' | 'fit'): void {
        const target = this._target()
        if (target) {
            if (action === 'fit') target.fitToView()
            else target.stepZoom(action === 'in' ? 1 : -1)
        }
        this.dispatchEvent(
            new CustomEvent('tc-zoom-action', {
                bubbles: true,
                composed: true,
                detail: { action },
            }),
        )
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        if (!origin) return
        if (origin.closest('.tc-zoom-control__in')) this._apply('in')
        else if (origin.closest('.tc-zoom-control__out')) this._apply('out')
        else if (origin.closest('.tc-zoom-control__fit')) this._apply('fit')
    }

    private _onCanvasZoom = (event: Event): void => {
        const id = this.htmlFor
        if (!id) return
        const source = event.target as HTMLElement | null
        if (source?.id !== id) return
        const detail = (event as CustomEvent<{ zoom: number; fit: number }>).detail
        if (!detail) return
        this.zoom = detail.zoom
        this.fit = detail.fit
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ZoomControl
    }
}
