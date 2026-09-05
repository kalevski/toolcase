import { VARIANTS_FULL } from './internal/variants'
import { setHostClass } from './internal/host-class'
import { Alert as BsAlert } from './internal/Alert'
import { closeIcon } from './icons'
import { msg } from './messages'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-alert'

export type AlertVariant =
    'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'

const VARIANTS: AlertVariant[] = [...VARIANTS_FULL]

/**
 * tc-alert — THE HOST IS THE ALERT.
 *
 * It renders no wrapper and never moves your children. Before 5.1 it captured its
 * child nodes and re-appended them inside a `.tc-alert-content` span — a span with
 * no styling attached to it at all, whose only effect was to make react-dom throw
 * `NotFoundError` from `parentInstance.removeChild(child)` when it removed one of
 * those children individually. The only node this element creates is the dismiss
 * button, and it is APPENDED.
 */
export class Alert extends HTMLElement {
    private _bsAlert: BsAlert | null = null
    private _built = false

    static get observedAttributes(): string[] {
        // `class` is observed so the element can re-assert its own classes after
        // react-dom overwrites `className` wholesale — see setHostClass.
        return ['variant', 'dismissible', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
        this._initBsAlert()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._built) return
        // A `class` change is either the element's own write settling or react-dom
        // overwriting `className`; re-asserting the classes is all it needs, and
        // tearing the Bootstrap behaviour down and back up for it would churn on
        // every render.
        if (name === 'class') {
            this.patch()
            return
        }
        this._teardown()
        this.patch()
        this._initBsAlert()
    }

    get variant(): AlertVariant {
        const v = this.getAttribute('variant') as AlertVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: AlertVariant) {
        setAttr(this, 'variant', v)
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

    /** In place: host classes, plus the one node the element owns. */
    private patch(): void {
        const dismissible = this.dismissible
        this.setAttribute('role', 'alert')
        setHostClass(
            this,
            `alert alert-${this.variant}${dismissible ? ' alert-dismissible fade show' : ''}`,
        )

        const existing = this.querySelector<HTMLButtonElement>(':scope > .btn-close')
        if (!dismissible) {
            existing?.remove()
            return
        }
        if (existing) return
        // Appended, not wrapped around anything. `.alert-dismissible` positions it
        // absolutely, so its place in the child list is not a layout decision.
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'btn-close'
        button.setAttribute('data-bs-dismiss', 'alert')
        button.setAttribute('aria-label', msg('close'))
        button.innerHTML = closeIcon
        this.append(button)
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
