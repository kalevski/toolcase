const TAG_NAME = 'tc-toggle'

export class Toggle extends HTMLElement {
    private _initialised = false

    /** Optional callback fired alongside the tc-change event. */
    onChange: ((on: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return ['on', 'disabled', 'label']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get on(): boolean {
        return this.hasAttribute('on')
    }
    set on(v: boolean) {
        if (v) this.setAttribute('on', '')
        else this.removeAttribute('on')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    private _onClick = (): void => {
        this._toggle()
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (this.disabled) return
        if (e.key !== ' ' && e.key !== 'Enter') return
        e.preventDefault()
        this._toggle()
    }

    private _toggle(): void {
        if (this.disabled) return
        const next = !this.on
        this.on = next
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { on: next },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(next)
    }

    private render(): void {
        const on = this.on
        const disabled = this.disabled
        const label = this.label

        this.setAttribute('role', 'switch')
        this.setAttribute('aria-checked', on ? 'true' : 'false')
        this.setAttribute('tabindex', disabled ? '-1' : '0')

        if (label) this.setAttribute('aria-label', label)
        else this.removeAttribute('aria-label')

        if (disabled) this.setAttribute('aria-disabled', 'true')
        else this.removeAttribute('aria-disabled')

        this.classList.add('tc-toggle')
        this.classList.toggle('tc-toggle--on', on)
        this.classList.toggle('tc-toggle--disabled', disabled)

        this.innerHTML = `<span class="tc-toggle-track" aria-hidden="true"><span class="tc-toggle-knob"></span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Toggle
    }
}
