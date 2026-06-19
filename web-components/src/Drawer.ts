import { DialogBase, esc } from './internal/dialog-base'
import { closeIcon } from './icons'

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
 */
export class Drawer extends DialogBase {
    private _bodyNodes: Node[] = []

    onClose: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['open', 'side', 'size', 'title', 'pinned']
    }

    // Capture slotted children before DialogBase's first render() wipes them;
    // render() re-appends them into .tc-drawer__body (and again on re-render).
    connectedCallback(): void {
        if (!this._initialised) {
            this._bodyNodes = Array.from(this.childNodes)
        }
        super.connectedCallback()
    }

    get side(): DrawerSide {
        const v = this.getAttribute('side') as DrawerSide
        return SIDES.includes(v) ? v : 'right'
    }
    set side(v: DrawerSide) {
        this.setAttribute('side', v)
    }

    get size(): DrawerSize {
        const v = this.getAttribute('size') as DrawerSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: DrawerSize) {
        this.setAttribute('size', v)
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

        this.innerHTML =
            backdropHtml +
            `<div class="tc-drawer__panel tc-drawer__panel--${side} tc-drawer__panel--${size}"` +
            ` role="dialog" aria-modal="${ariaModal}" aria-labelledby="${labelId}"` +
            ` tabindex="-1" aria-hidden="${panelAriaHidden}"${hiddenAttr}>` +
            `<div class="tc-drawer__header">` +
            `<span class="tc-drawer__title" id="${labelId}">${titleText}</span>` +
            `<button type="button" class="tc-drawer__close" aria-label="Close">${closeIcon}</button>` +
            `</div>` +
            `<div class="tc-drawer__body"></div>` +
            `</div>`

        const body = this.querySelector('.tc-drawer__body')
        if (body) this._bodyNodes.forEach((n) => body.appendChild(n))

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
