const TAG_NAME = 'tc-list-row'

export class ListRow extends HTMLElement {
    private _initialised = false

    /** Optional callback fired alongside the `tc-select` CustomEvent. */
    onSelect: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected', 'disabled', 'accent']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'option')
            this._initialised = true
        }
        this.render()
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

    get selected(): boolean {
        return this.hasAttribute('selected')
    }
    set selected(value: boolean) {
        if (value) this.setAttribute('selected', '')
        else this.removeAttribute('selected')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(value: boolean) {
        if (value) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get accent(): string {
        return this.getAttribute('accent') ?? ''
    }
    set accent(value: string) {
        if (value) this.setAttribute('accent', value)
        else this.removeAttribute('accent')
    }

    private _onClick = (): void => {
        if (this.disabled) return
        this._select()
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        if (this.disabled) return
        e.preventDefault()
        this._select()
    }

    private _select(): void {
        this.dispatchEvent(new CustomEvent('tc-select', {
            bubbles: true,
            composed: true,
            detail: {},
        }))
        if (typeof this.onSelect === 'function') this.onSelect()
    }

    private render(): void {
        const selected = this.selected
        const disabled = this.disabled
        const accent = this.accent

        this.classList.toggle('tc-list-row--selected', selected)
        this.classList.toggle('tc-list-row--disabled', disabled)

        this.setAttribute('aria-selected', selected ? 'true' : 'false')

        if (disabled) {
            this.setAttribute('aria-disabled', 'true')
            this.setAttribute('tabindex', '-1')
        } else {
            this.removeAttribute('aria-disabled')
            this.setAttribute('tabindex', '0')
        }

        if (accent) {
            this.style.setProperty('--bs-list-row-accent', accent)
        } else {
            this.style.removeProperty('--bs-list-row-accent')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ListRow
    }
}
