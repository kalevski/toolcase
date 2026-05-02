const TAG_NAME = 'gc-interact-prompt'

export class InteractPrompt extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['show', 'key-label', 'text', 'hold-progress']
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

    get show(): boolean {
        return this.hasAttribute('show')
    }
    set show(value: boolean) {
        if (value) this.setAttribute('show', '')
        else this.removeAttribute('show')
    }

    get keyLabel(): string {
        return this.getAttribute('key-label') ?? ''
    }
    set keyLabel(value: string) {
        this.setAttribute('key-label', value)
    }

    get text(): string {
        return this.getAttribute('text') ?? ''
    }
    set text(value: string) {
        this.setAttribute('text', value)
    }

    get holdProgress(): number | null {
        const raw = this.getAttribute('hold-progress')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        if (Number.isNaN(parsed)) return null
        return Math.max(0, Math.min(1, parsed))
    }
    set holdProgress(value: number | null) {
        if (value == null) this.removeAttribute('hold-progress')
        else this.setAttribute('hold-progress', String(value))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const key = this.keyLabel
        const text = this.text
        const hold = this.holdProgress
        const holdBar = hold != null ? `
            <div class="gc-interact-prompt-hold">
                <div class="gc-interact-prompt-hold-fill" style="width: ${(hold * 100).toFixed(2)}%"></div>
            </div>
        ` : ''
        const keyMarkup = key ? `<gc-key class="gc-interact-prompt-key">${this.escape(key)}</gc-key>` : ''
        this.innerHTML = `
            <div class="gc-interact-prompt-row">
                ${keyMarkup}
                <span class="gc-interact-prompt-text">${this.escape(text)}</span>
            </div>
            ${holdBar}
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InteractPrompt
    }
}
