const TAG_NAME = 'gc-screen-flash'

export interface ScreenFlashEventMap {
    done: CustomEvent<void>
}

export class ScreenFlash extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['flash-color', 'flash-opacity', 'duration', 'trigger']
    }

    private root: ShadowRoot
    private timer: number | null = null
    private lastTrigger: string | null = null

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<div class="gc-screen-flash-fill"></div>`
    }

    connectedCallback(): void {
        this.applyStyle()
        this.lastTrigger = this.getAttribute('trigger')
    }

    disconnectedCallback(): void {
        this.clearTimer()
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (!this.isConnected) return
        if (name === 'trigger') {
            if (newValue !== null && newValue !== this.lastTrigger) {
                this.lastTrigger = newValue
                this.flash()
            }
            return
        }
        this.applyStyle()
    }

    get flashColor(): string {
        return this.getAttribute('flash-color') ?? '#ffffff'
    }
    set flashColor(value: string) {
        this.setAttribute('flash-color', value)
    }

    get flashOpacity(): number {
        const raw = this.getAttribute('flash-opacity')
        if (raw == null) return 1
        const parsed = parseFloat(raw)
        if (Number.isNaN(parsed)) return 1
        return Math.max(0, Math.min(1, parsed))
    }
    set flashOpacity(value: number) {
        this.setAttribute('flash-opacity', String(value))
    }

    get duration(): number {
        const raw = this.getAttribute('duration')
        if (raw == null) return 200
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 200 : parsed
    }
    set duration(value: number) {
        this.setAttribute('duration', String(value))
    }

    get trigger(): string | null {
        return this.getAttribute('trigger')
    }
    set trigger(value: string | null) {
        if (value == null) this.removeAttribute('trigger')
        else this.setAttribute('trigger', value)
    }

    private clearTimer(): void {
        if (this.timer != null) {
            window.clearTimeout(this.timer)
            this.timer = null
        }
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private applyStyle(): void {
        const fill = this.root.querySelector('.gc-screen-flash-fill') as HTMLElement | null
        if (!fill) return
        fill.style.background = this.flashColor
        fill.style.setProperty('--gc-screen-flash-duration', `${this.duration}ms`)
    }

    private flash(): void {
        this.applyStyle()
        const fill = this.root.querySelector('.gc-screen-flash-fill') as HTMLElement | null
        if (!fill) return
        this.clearTimer()
        fill.style.transition = 'none'
        fill.style.opacity = String(this.flashOpacity)
        void fill.offsetWidth
        fill.style.transition = `opacity ${this.duration}ms ease-out`
        fill.style.opacity = '0'
        this.timer = window.setTimeout(() => {
            this.timer = null
            this.emit('done')
        }, this.duration)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ScreenFlash
    }
}
