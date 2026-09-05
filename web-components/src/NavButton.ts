import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { msg } from './messages'
import { chevronLeftIcon, closeIcon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-nav-button'

export type NavButtonKind = 'back' | 'close'
const KINDS: NavButtonKind[] = ['back', 'close']

export class NavButton extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['kind', 'label', 'size', 'disabled']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get kind(): NavButtonKind {
        const v = this.getAttribute('kind') as NavButtonKind
        return KINDS.includes(v) ? v : 'back'
    }
    set kind(v: NavButtonKind) {
        setAttr(this, 'kind', v)
    }

    get label(): string {
        return this.getAttribute('label') || ''
    }
    set label(v: string) {
        if (v) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get size(): number | null {
        const raw = this.getAttribute('size')
        if (raw === null) return null
        const n = parseFloat(raw)
        return Number.isNaN(n) ? null : n
    }
    set size(v: number | null) {
        if (v === null) this.removeAttribute('size')
        else this.setAttribute('size', String(v))
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private render(): void {
        const kind = this.kind
        const label = this.label
        const size = this.size
        const disabled = this.disabled

        if (size !== null) this.style.setProperty('--bs-nav-button-size', `${size}px`)
        else this.style.removeProperty('--bs-nav-button-size')

        // Through the registry rather than hardcoded, so one configureMessages()
        // call localises this and tc-app-bar's chevron together.
        const ariaLabel = label || (kind === 'close' ? msg('close') : msg('back'))
        const kindClass = kind === 'close' ? ' tc-nav-button__btn--close' : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const glyph = kind === 'close' ? closeIcon : chevronLeftIcon

        patchHtml(
            this,
            `<button type="button" class="tc-nav-button__btn${kindClass}" aria-label="${esc(ariaLabel)}"${disabledAttr}>${glyph}</button>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: NavButton
    }
}
