const TAG_NAME = 'gc-damage-number'

export interface DamageNumberEventMap {
    done: CustomEvent<void>
}

export class DamageNumber extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['value', 'crit', 'heal', 'miss', 'duration']
    }

    private root: ShadowRoot
    private timer: number | null = null

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.render()
        this.schedule()
    }

    disconnectedCallback(): void {
        this.clearTimer()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get value(): string {
        return this.getAttribute('value') || ''
    }
    set value(value: string) {
        if (value) this.setAttribute('value', value)
        else this.removeAttribute('value')
    }

    get crit(): boolean {
        return this.hasAttribute('crit')
    }
    set crit(value: boolean) {
        if (value) this.setAttribute('crit', '')
        else this.removeAttribute('crit')
    }

    get heal(): boolean {
        return this.hasAttribute('heal')
    }
    set heal(value: boolean) {
        if (value) this.setAttribute('heal', '')
        else this.removeAttribute('heal')
    }

    get miss(): boolean {
        return this.hasAttribute('miss')
    }
    set miss(value: boolean) {
        if (value) this.setAttribute('miss', '')
        else this.removeAttribute('miss')
    }

    get duration(): number {
        const raw = this.getAttribute('duration')
        if (raw == null) return 700
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 700 : parsed
    }
    set duration(value: number) {
        this.setAttribute('duration', String(value))
    }

    private clearTimer(): void {
        if (this.timer != null) {
            window.clearTimeout(this.timer)
            this.timer = null
        }
    }

    private schedule(): void {
        this.clearTimer()
        this.timer = window.setTimeout(() => {
            this.timer = null
            this.emit('done')
        }, this.duration)
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private render(): void {
        const variant = this.miss ? 'miss' : this.heal ? 'heal' : this.crit ? 'crit' : 'normal'
        const text = this.miss ? 'MISS' : this.value
        const prefix = this.heal ? '+' : ''
        this.style.setProperty('--gc-damage-number-duration', `${this.duration}ms`)
        this.innerHTML = `<span class="gc-damage-number-text" data-variant="${variant}">${prefix}${this.escape(text)}</span>`
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, DamageNumber)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DamageNumber
    }
}
