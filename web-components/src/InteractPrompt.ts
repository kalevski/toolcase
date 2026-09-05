import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-interact-prompt'

export class InteractPrompt extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['show', 'key-label', 'text', 'hold-progress']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        // role="status" + aria-live so the prompt is announced when it appears or
        // its text changes. Hidden state is conveyed by display:none (handled in CSS),
        // which also removes the host from the accessibility tree while not shown.
        this.setAttribute('role', 'status')
        this.setAttribute('aria-live', 'polite')
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
        setAttr(this, 'key-label', value)
    }

    get text(): string {
        return this.getAttribute('text') ?? ''
    }
    set text(value: string) {
        setAttr(this, 'text', value)
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

    private render(): void {
        const key = this.keyLabel
        const text = this.text
        const hold = this.holdProgress

        const keyMarkup = key ? `<span class="tc-interact-prompt-key">${esc(key)}</span>` : ''

        const holdMarkup =
            hold != null
                ? `
            <div class="tc-interact-prompt-hold" role="progressbar" aria-valuemin="0" aria-valuemax="1" aria-valuenow="${hold.toFixed(2)}">
                <div class="tc-interact-prompt-hold-fill" style="width: ${(hold * 100).toFixed(2)}%"></div>
            </div>`
                : ''

        patchHtml(
            this,
            `
            <div class="tc-interact-prompt-row">
                ${keyMarkup}
                <span class="tc-interact-prompt-text">${esc(text)}</span>
            </div>
            ${holdMarkup}
        `,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InteractPrompt
    }
}
