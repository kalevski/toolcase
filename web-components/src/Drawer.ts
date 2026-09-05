import { patchHtml } from './internal/patch-html'
import { adoptChildren } from './internal/adopt-children'
import { DialogBase, esc } from './internal/dialog-base'
import { msg } from './messages'
import { closeIcon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-drawer'

export type DrawerSide = 'left' | 'right' | 'top' | 'bottom'
export type DrawerSize = 'small' | 'default' | 'large'

const SIDES: DrawerSide[] = ['left', 'right', 'top', 'bottom']
const SIZES: DrawerSize[] = ['small', 'default', 'large']

/**
 * tc-drawer — an edge-anchored panel on the shared {@link DialogBase} scaffold
 * (focus trap, scroll lock, Escape-to-close, Tab cycling, backdrop dismiss).
 * Drawer specifics: slotted body content, the side/size options, a close
 * button, and a `pinned` non-modal mode that keeps page scroll and drops the
 * backdrop.
 *
 * The panel is a real descendant of the host, not the host itself: DialogBase's
 * shared scaffold (focus trap, Tab cycling, open/close aria-hidden + hidden
 * toggling) locates it via `this.querySelector('.tc-drawer__panel')`, which can
 * only ever match a descendant — never the host `this` is called on.
 */
export class Drawer extends DialogBase {
    // Consumer children captured before the first render (patchHtml never moves
    // unowned nodes — rule 1); adoptChildren re-homes them into .tc-drawer__body
    // afterwards and keeps react-dom's mutation calls against the host working
    // once they live one level deeper (see internal/adopt-children.ts).
    private _capturedNodes: Node[] | null = null

    onClose: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['open', 'side', 'size', 'title', 'pinned']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._capturedNodes = Array.from(this.childNodes)
        }
        super.connectedCallback()
        if (this._capturedNodes) {
            const nodes = this._capturedNodes
            this._capturedNodes = null
            const body = this.querySelector('.tc-drawer__body')
            if (body) adoptChildren(this, () => body, nodes)
        }
    }

    get side(): DrawerSide {
        const v = this.getAttribute('side') as DrawerSide
        return SIDES.includes(v) ? v : 'right'
    }
    set side(v: DrawerSide) {
        setAttr(this, 'side', v)
    }

    get size(): DrawerSize {
        const v = this.getAttribute('size') as DrawerSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: DrawerSize) {
        setAttr(this, 'size', v)
    }

    // `title` is natively reflected by HTMLElement; no getter/setter defined.
    // Listed in observedAttributes so attributeChangedCallback fires on changes.
    // Read via this.getAttribute('title') inside render().

    get pinned(): boolean {
        return this.hasAttribute('pinned')
    }
    set pinned(v: boolean) {
        if (v) this.setAttribute('pinned', '')
        else this.removeAttribute('pinned')
    }

    // ── DialogBase hooks ─────────────────────────────────────────────────────────

    // Pinned mode is non-modal: keep page scroll usable.
    protected shouldLockScroll(): boolean {
        return !this.pinned
    }

    protected onCloseRequest(): void {
        this._requestClose()
    }

    protected onBodyClick(e: MouseEvent): void {
        if ((e.target as Element)?.closest('.tc-drawer__close')) {
            this._requestClose()
        }
    }

    private _requestClose(): void {
        this.dispatchEvent(
            new CustomEvent('tc-close', {
                bubbles: true,
                composed: true,
                detail: {},
            }),
        )
        if (typeof this.onClose === 'function') this.onClose()
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    protected render(): void {
        const side = this.side
        const size = this.size
        const pinned = this.pinned
        const titleText = esc(this.getAttribute('title') ?? '')
        const isOpen = this.open

        const ariaModal = pinned ? 'false' : 'true'
        const labelId = `${this._idPrefix}-title`
        const hiddenAttr = isOpen ? '' : ' hidden'
        const panelAriaHidden = isOpen ? 'false' : 'true'

        const backdropHtml = pinned
            ? ''
            : `<div class="tc-drawer__backdrop" aria-hidden="true"${hiddenAttr}></div>`

        patchHtml(
            this,
            backdropHtml +
                `<div class="tc-drawer__panel tc-drawer__panel--${side} tc-drawer__panel--${size}"` +
                ` role="dialog" aria-modal="${ariaModal}" aria-labelledby="${labelId}"` +
                ` tabindex="-1" aria-hidden="${panelAriaHidden}"${hiddenAttr}>` +
                `<div class="tc-drawer__header">` +
                `<span class="tc-drawer__title" id="${labelId}">${titleText}</span>` +
                `<button type="button" class="tc-drawer__close" aria-label="${esc(msg('close'))}">${closeIcon}</button>` +
                `</div>` +
                `<div class="tc-drawer__body"></div>` +
                `</div>`,
        )

        if (isOpen) {
            this.classList.add('tc-drawer--open')
        } else {
            this.classList.remove('tc-drawer--open')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Drawer
    }
}
