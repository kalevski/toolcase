import { Alert as BsAlert } from './internal/Alert'
import { closeIcon } from './icons'

const TAG_NAME = 'tc-alert'

export type AlertVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'

const VARIANTS: AlertVariant[] = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']

export class Alert extends HTMLElement {

    private _bsAlert: BsAlert | null = null
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'dismissible']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-alert-content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
        this._initBsAlert()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._teardown()
        const inner = this.querySelector('.tc-alert-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-alert-content')
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
        this._initBsAlert()
    }

    get variant(): AlertVariant {
        const v = this.getAttribute('variant') as AlertVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: AlertVariant) {
        this.setAttribute('variant', v)
    }

    get dismissible(): boolean {
        return this.hasAttribute('dismissible')
    }
    set dismissible(v: boolean) {
        if (v) this.setAttribute('dismissible', '')
        else this.removeAttribute('dismissible')
    }

    close(): void {
        if (this._bsAlert) {
            this._bsAlert.close()
        } else {
            this.remove()
        }
    }

    private _onClosed = (): void => {
        this.dispatchEvent(new CustomEvent('tc-closed', { bubbles: true, composed: true }))
    }

    private render(): void {
        const variant = this.variant
        const dismissible = this.dismissible
        this.setAttribute('role', 'alert')
        this.className = `alert alert-${variant}${dismissible ? ' alert-dismissible fade show' : ''}`
        this.innerHTML = `<span class="tc-alert-content"></span>${dismissible ? `<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close">${closeIcon}</button>` : ''}`
    }

    private _initBsAlert(): void {
        if (!this.dismissible) return
        this._bsAlert = new BsAlert(this)
        this.addEventListener('closed.bs.alert', this._onClosed)
    }

    private _teardown(): void {
        this.removeEventListener('closed.bs.alert', this._onClosed)
        if (this._bsAlert) {
            this._bsAlert.dispose()
            this._bsAlert = null
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Alert
    }
}
