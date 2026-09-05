import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-press-any-key'

// Keys that should NOT trigger tc-continue; they are modifier-only presses.
const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta'])

export class PressAnyKey extends HTMLElement {
    private _initialised = false

    /** Optional callback invoked synchronously alongside the tc-continue event. */
    onContinue: ((e: CustomEvent<void>) => void) | null = null

    static get observedAttributes(): string[] {
        return ['text', 'disabled']
    }

    private _keyHandler = (e: KeyboardEvent): void => {
        if (!this.isConnected || this.disabled) return
        if (IGNORED_KEYS.has(e.key)) return
        this._fire()
    }

    private _mouseHandler = (): void => {
        if (this.disabled) return
        this._fire()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
            this.render()
            this._initialised = true
        }
        // Listeners re-attached every connect so they survive disconnect/reconnect.
        document.addEventListener('keydown', this._keyHandler)
        this.addEventListener('mousedown', this._mouseHandler)
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this._keyHandler)
        this.removeEventListener('mousedown', this._mouseHandler)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get text(): string {
        return this.getAttribute('text') ?? 'Press Any Key'
    }
    set text(v: string) {
        if (v) this.setAttribute('text', v)
        else this.removeAttribute('text')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private _fire(): void {
        const ev = new CustomEvent<void>('tc-continue', { bubbles: true, composed: true })
        this.dispatchEvent(ev)
        if (typeof this.onContinue === 'function') this.onContinue(ev)
    }

    private render(): void {
        this.classList.add('tc-press-any-key')
        // A real `disabled` attribute would remove the host from the accessibility
        // tree entirely, and this element has no separate focusable child to fall
        // back on — so, like FilterTrigger/LockedAction, disabled state is conveyed
        // via `aria-disabled` + `tabindex="-1"` instead, keeping the host reachable
        // by assistive tech while pulling it out of the tab order.
        this.setAttribute('tabindex', this.disabled ? '-1' : '0')
        if (this.disabled) this.setAttribute('aria-disabled', 'true')
        else this.removeAttribute('aria-disabled')
        patchHtml(this, `<span class="tc-press-any-key__text">${esc(this.text)}</span>`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PressAnyKey
    }
}
