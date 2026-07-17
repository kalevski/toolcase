import { closeIcon } from './icons'
import { esc } from './internal/esc'
import { msg } from './messages'

const TAG_NAME = 'tc-close-button'

export class CloseButton extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['disabled', 'aria-label']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get ariaLabel(): string {
        return this.getAttribute('aria-label') ?? msg('close')
    }
    set ariaLabel(v: string) {
        this.setAttribute('aria-label', v)
    }

    private render(): void {
        const label = this.ariaLabel
        const disabledAttr = this.disabled ? ' disabled' : ''
        this.innerHTML = `<button type="button" class="btn-close" aria-label="${esc(label)}"${disabledAttr}>${closeIcon}</button>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CloseButton
    }
}
