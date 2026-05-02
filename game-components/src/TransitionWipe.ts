const TAG_NAME = 'gc-transition-wipe'

export type TransitionWipeDirection = 'fade' | 'left' | 'right' | 'up' | 'down' | 'iris'

export interface TransitionWipeEventMap {
    complete: CustomEvent<void>
}

export class TransitionWipe extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['show', 'direction', 'duration', 'wipe-color']
    }

    private root: ShadowRoot
    private timer: number | null = null

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<div class="gc-transition-wipe-fill"></div>`
    }

    connectedCallback(): void {
        this.applyStyle()
        if (this.show) this.scheduleComplete()
    }

    disconnectedCallback(): void {
        this.clearTimer()
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
        if (!this.isConnected) return
        if (name === 'show') {
            if (newValue !== null) this.scheduleComplete()
            else this.clearTimer()
        }
        this.applyStyle()
    }

    get show(): boolean {
        return this.hasAttribute('show')
    }
    set show(value: boolean) {
        if (value) this.setAttribute('show', '')
        else this.removeAttribute('show')
    }

    get direction(): TransitionWipeDirection {
        const raw = (this.getAttribute('direction') ?? 'fade') as TransitionWipeDirection
        const allowed: TransitionWipeDirection[] = ['fade', 'left', 'right', 'up', 'down', 'iris']
        return allowed.includes(raw) ? raw : 'fade'
    }
    set direction(value: TransitionWipeDirection) {
        this.setAttribute('direction', value)
    }

    get duration(): number {
        const raw = this.getAttribute('duration')
        if (raw == null) return 400
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 400 : parsed
    }
    set duration(value: number) {
        this.setAttribute('duration', String(value))
    }

    get wipeColor(): string {
        return this.getAttribute('wipe-color') ?? '#0a0604'
    }
    set wipeColor(value: string) {
        this.setAttribute('wipe-color', value)
    }

    private clearTimer(): void {
        if (this.timer != null) {
            window.clearTimeout(this.timer)
            this.timer = null
        }
    }

    private scheduleComplete(): void {
        this.clearTimer()
        this.timer = window.setTimeout(() => {
            this.timer = null
            this.emit('complete')
        }, this.duration)
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private applyStyle(): void {
        const fill = this.root.querySelector('.gc-transition-wipe-fill') as HTMLElement | null
        if (!fill) return
        fill.dataset.direction = this.direction
        fill.style.background = this.wipeColor
        fill.style.setProperty('--gc-transition-wipe-duration', `${this.duration}ms`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TransitionWipe
    }
}
