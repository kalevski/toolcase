const TAG_NAME = 'gc-shake-container'

export class ShakeContainer extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['trigger', 'intensity', 'duration']
    }

    private root: ShadowRoot
    private rafHandle: number | null = null
    private startedAt: number = 0
    private lastTrigger: string | null = null

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<div class="gc-shake-container-inner"><slot></slot></div>`
    }

    connectedCallback(): void {
        this.lastTrigger = this.getAttribute('trigger')
    }

    disconnectedCallback(): void {
        this.stopShake()
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
        if (!this.isConnected) return
        if (name === 'trigger' && newValue !== this.lastTrigger) {
            this.lastTrigger = newValue
            this.startShake()
        }
    }

    get trigger(): string | null {
        return this.getAttribute('trigger')
    }
    set trigger(value: string | null) {
        if (value == null) this.removeAttribute('trigger')
        else this.setAttribute('trigger', value)
    }

    get intensity(): number {
        const raw = this.getAttribute('intensity')
        if (raw == null) return 8
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed < 0 ? 8 : parsed
    }
    set intensity(value: number) {
        this.setAttribute('intensity', String(value))
    }

    get duration(): number {
        const raw = this.getAttribute('duration')
        if (raw == null) return 350
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 350 : parsed
    }
    set duration(value: number) {
        this.setAttribute('duration', String(value))
    }

    private stopShake(): void {
        if (this.rafHandle != null) {
            cancelAnimationFrame(this.rafHandle)
            this.rafHandle = null
        }
        const inner = this.root.querySelector('.gc-shake-container-inner') as HTMLElement | null
        if (inner) inner.style.transform = ''
    }

    private startShake(): void {
        this.stopShake()
        this.startedAt = performance.now()
        const inner = this.root.querySelector('.gc-shake-container-inner') as HTMLElement | null
        if (!inner) return
        const tick = (now: number) => {
            const elapsed = now - this.startedAt
            const total = this.duration
            if (elapsed >= total) {
                inner.style.transform = ''
                this.rafHandle = null
                return
            }
            const decay = 1 - elapsed / total
            const range = this.intensity * decay
            const x = (Math.random() * 2 - 1) * range
            const y = (Math.random() * 2 - 1) * range
            inner.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`
            this.rafHandle = requestAnimationFrame(tick)
        }
        this.rafHandle = requestAnimationFrame(tick)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ShakeContainer
    }
}
