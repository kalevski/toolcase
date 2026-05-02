const TAG_NAME = 'gc-dialogue-box'

export interface DialogueChoice {
    id: string
    label: string
    disabled?: boolean
}

export interface DialogueBoxEventMap {
    choice: CustomEvent<{ id: string }>
    advance: CustomEvent<void>
}

export class DialogueBox extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['speaker', 'text', 'typing-speed']
    }

    private _choices: DialogueChoice[] = []
    private typingTimer: number | null = null
    private typedLength = 0
    private clickHandler = (event: Event) => this.handleClick(event)

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        this.addEventListener('click', this.clickHandler)
        this.render()
        this.startTyping()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this.clickHandler)
        this.stopTyping()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected) return
        if (name === 'text') {
            this.render()
            this.startTyping()
            return
        }
        this.render()
    }

    get speaker(): string {
        return this.getAttribute('speaker') ?? ''
    }
    set speaker(v: string) {
        if (v) this.setAttribute('speaker', v)
        else this.removeAttribute('speaker')
    }

    get text(): string {
        return this.getAttribute('text') ?? ''
    }
    set text(v: string) {
        if (v) this.setAttribute('text', v)
        else this.removeAttribute('text')
    }

    get typingSpeed(): number {
        const raw = this.getAttribute('typing-speed')
        if (raw == null) return 24
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 24
    }
    set typingSpeed(v: number) {
        this.setAttribute('typing-speed', String(v))
    }

    get choices(): DialogueChoice[] {
        return this._choices
    }
    set choices(value: DialogueChoice[]) {
        this._choices = Array.isArray(value) ? value : []
        if (this.isConnected) this.render()
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private stopTyping(): void {
        if (this.typingTimer != null) {
            window.clearInterval(this.typingTimer)
            this.typingTimer = null
        }
    }

    private startTyping(): void {
        this.stopTyping()
        const full = this.text
        this.typedLength = 0
        this.updateTyped()
        if (!full) return
        const interval = Math.max(8, 1000 / this.typingSpeed)
        this.typingTimer = window.setInterval(() => {
            this.typedLength += 1
            this.updateTyped()
            if (this.typedLength >= full.length) this.stopTyping()
        }, interval)
    }

    private isTyping(): boolean {
        return this.typingTimer != null
    }

    private updateTyped(): void {
        const textEl = this.querySelector('.gc-dialogue-box-text') as HTMLElement | null
        if (!textEl) return
        const full = this.text
        const visible = full.slice(0, this.typedLength)
        textEl.textContent = visible
        const choicesEl = this.querySelector('.gc-dialogue-box-choices') as HTMLElement | null
        if (choicesEl) {
            choicesEl.classList.toggle('is-visible', !this.isTyping() && this._choices.length > 0)
        }
        const indicator = this.querySelector('.gc-dialogue-box-indicator') as HTMLElement | null
        if (indicator) {
            indicator.classList.toggle('is-visible', !this.isTyping() && this._choices.length === 0)
        }
    }

    private handleClick(event: Event): void {
        const target = event.target as HTMLElement
        if (target.closest('.gc-dialogue-box-choice')) return
        if (this.isTyping()) {
            this.typedLength = this.text.length
            this.stopTyping()
            this.updateTyped()
            return
        }
        if (this._choices.length === 0) {
            this.emit('advance')
        }
    }

    private render(): void {
        const speaker = this.speaker
        const speakerMarkup = speaker
            ? `<div class="gc-dialogue-box-speaker"><gc-eyebrow class="gc-dialogue-box-eyebrow">Speaker</gc-eyebrow><div class="gc-dialogue-box-speaker-name">${this.escape(speaker)}</div></div>`
            : ''
        const choicesMarkup = this._choices.length
            ? `<div class="gc-dialogue-box-choices">${this._choices.map((c) => {
                const cls = `gc-dialogue-box-choice${c.disabled ? ' is-disabled' : ''}`
                const tabindex = c.disabled ? '-1' : '0'
                const disabledAttr = c.disabled ? ' aria-disabled="true"' : ''
                return `<div role="button" tabindex="${tabindex}"${disabledAttr} class="${cls}" data-id="${this.escape(c.id)}">▸ ${this.escape(c.label)}</div>`
            }).join('')}</div>`
            : ''
        this.innerHTML = `
            ${speakerMarkup}
            <div class="gc-dialogue-box-body">
                <span class="gc-dialogue-box-text"></span>
                <span class="gc-dialogue-box-indicator">▾</span>
            </div>
            ${choicesMarkup}
        `
        this.updateTyped()

        this.querySelectorAll<HTMLElement>('.gc-dialogue-box-choice').forEach((el) => {
            const handle = (event: Event) => {
                event.stopPropagation()
                const id = el.dataset.id || ''
                const c = this._choices.find((x) => x.id === id)
                if (!c || c.disabled) return
                this.emit('choice', { id })
            }
            el.addEventListener('click', handle)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                handle(event)
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, DialogueBox)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DialogueBox
    }
}
