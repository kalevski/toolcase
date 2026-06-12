const TAG_NAME = 'tc-option'

export class Option extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['value', 'selected', 'disabled']
    }

    connectedCallback(): void {
        this._notifyParent()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this._notifyParent()
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        this.setAttribute('value', v)
    }

    get selected(): boolean {
        return this.hasAttribute('selected')
    }
    set selected(v: boolean) {
        if (v) this.setAttribute('selected', '')
        else this.removeAttribute('selected')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private _notifyParent(): void {
        const parent = this.closest('tc-select')
        if (parent) (parent as any)._scheduleRender()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Option
    }
}
