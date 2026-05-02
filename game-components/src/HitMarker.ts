const TAG_NAME = 'gc-hit-marker'

export interface HitMarkerEventMap {
    done: CustomEvent<void>
}

export class HitMarker extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['show', 'crit', 'kill', 'size', 'duration']
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
        if (this.show) this.scheduleHide()
    }

    disconnectedCallback(): void {
        this.clearTimer()
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (!this.isConnected) return
        if (name === 'show') {
            if (newValue !== null) this.scheduleHide()
            else this.clearTimer()
        }
        this.render()
    }

    get show(): boolean {
        return this.hasAttribute('show')
    }
    set show(value: boolean) {
        if (value) this.setAttribute('show', '')
        else this.removeAttribute('show')
    }

    get crit(): boolean {
        return this.hasAttribute('crit')
    }
    set crit(value: boolean) {
        if (value) this.setAttribute('crit', '')
        else this.removeAttribute('crit')
    }

    get kill(): boolean {
        return this.hasAttribute('kill')
    }
    set kill(value: boolean) {
        if (value) this.setAttribute('kill', '')
        else this.removeAttribute('kill')
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 24
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 24 : parsed
    }
    set size(value: number) {
        this.setAttribute('size', String(value))
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

    private clearTimer(): void {
        if (this.timer != null) {
            window.clearTimeout(this.timer)
            this.timer = null
        }
    }

    private scheduleHide(): void {
        this.clearTimer()
        this.timer = window.setTimeout(() => {
            this.timer = null
            this.show = false
            this.emit('done')
        }, this.duration)
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private render(): void {
        const size = this.size
        this.style.setProperty('--gc-hit-marker-size', `${size}px`)

        const variant = this.kill ? 'kill' : (this.crit ? 'crit' : 'normal')
        const skull = this.kill ? `<span class="gc-hit-marker-glyph">☠</span>` : ''

        this.innerHTML = `
            <svg class="gc-hit-marker-svg" data-variant="${variant}" viewBox="0 0 24 24" aria-hidden="true">
                <line x1="4" y1="4" x2="9" y2="9" class="gc-hit-marker-line"></line>
                <line x1="20" y1="4" x2="15" y2="9" class="gc-hit-marker-line"></line>
                <line x1="4" y1="20" x2="9" y2="15" class="gc-hit-marker-line"></line>
                <line x1="20" y1="20" x2="15" y2="15" class="gc-hit-marker-line"></line>
            </svg>
            ${skull}
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: HitMarker
    }
}
