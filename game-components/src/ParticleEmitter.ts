const TAG_NAME = 'gc-particle-emitter'

interface Particle {
    x: number
    y: number
    vx: number
    vy: number
    life: number
    maxLife: number
    color: string
    size: number
}

export class ParticleEmitter extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['burst', 'count', 'particle-size', 'speed', 'lifetime', 'gravity', 'width', 'height']
    }

    private canvas: HTMLCanvasElement | null = null
    private ctx: CanvasRenderingContext2D | null = null
    private particles: Particle[] = []
    private rafHandle: number | null = null
    private lastBurst: string | null = null
    private _colors: string[] = ['#f0d27a', '#c9a961', '#e0584a', '#5a8cf0']

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
        this.lastBurst = this.getAttribute('burst')
    }

    disconnectedCallback(): void {
        this.stop()
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
        if (!this.isConnected) return
        if (name === 'burst' && newValue !== this.lastBurst) {
            this.lastBurst = newValue
            this.spawnBurst()
            return
        }
        if (name === 'width' || name === 'height') this.render()
    }

    get count(): number {
        const raw = this.getAttribute('count')
        if (raw == null) return 24
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) || parsed <= 0 ? 24 : parsed
    }
    set count(v: number) {
        this.setAttribute('count', String(v))
    }

    get colors(): string[] {
        return this._colors.slice()
    }
    set colors(values: string[]) {
        if (Array.isArray(values) && values.length > 0) this._colors = values.slice()
    }

    get particleSize(): number {
        const raw = this.getAttribute('particle-size')
        if (raw == null) return 4
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 4 : parsed
    }
    set particleSize(v: number) {
        this.setAttribute('particle-size', String(v))
    }

    get speed(): number {
        const raw = this.getAttribute('speed')
        if (raw == null) return 200
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 200 : parsed
    }
    set speed(v: number) {
        this.setAttribute('speed', String(v))
    }

    get lifetime(): number {
        const raw = this.getAttribute('lifetime')
        if (raw == null) return 700
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 700 : parsed
    }
    set lifetime(v: number) {
        this.setAttribute('lifetime', String(v))
    }

    get gravity(): number {
        const raw = this.getAttribute('gravity')
        if (raw == null) return 600
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 600 : parsed
    }
    set gravity(v: number) {
        this.setAttribute('gravity', String(v))
    }

    get width(): number {
        const raw = this.getAttribute('width')
        if (raw == null) return 240
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 240 : parsed
    }
    set width(v: number) {
        this.setAttribute('width', String(v))
    }

    get height(): number {
        const raw = this.getAttribute('height')
        if (raw == null) return 160
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 160 : parsed
    }
    set height(v: number) {
        this.setAttribute('height', String(v))
    }

    burst(value?: string): void {
        const v = value ?? String(Date.now())
        this.setAttribute('burst', v)
    }

    private render(): void {
        const w = this.width
        const h = this.height
        this.innerHTML = `<canvas class="gc-particle-emitter-canvas" width="${w}" height="${h}"></canvas>`
        this.canvas = this.querySelector('canvas') as HTMLCanvasElement
        this.ctx = this.canvas.getContext('2d')
    }

    private spawnBurst(): void {
        if (!this.canvas) this.render()
        const w = this.width
        const h = this.height
        const cx = w / 2
        const cy = h / 2
        const count = this.count
        const speed = this.speed
        const lifetime = this.lifetime
        const colors = this._colors
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3
            const v = speed * (0.7 + Math.random() * 0.6)
            this.particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * v,
                vy: Math.sin(angle) * v,
                life: 0,
                maxLife: lifetime * (0.8 + Math.random() * 0.4),
                color: colors[Math.floor(Math.random() * colors.length)],
                size: this.particleSize * (0.7 + Math.random() * 0.6),
            })
        }
        this.startLoop()
    }

    private startLoop(): void {
        if (this.rafHandle != null) return
        let lastT = performance.now()
        const loop = (now: number) => {
            const dt = Math.min(0.05, (now - lastT) / 1000)
            lastT = now
            this.step(dt)
            if (this.particles.length === 0) {
                this.stop()
                return
            }
            this.rafHandle = requestAnimationFrame(loop)
        }
        this.rafHandle = requestAnimationFrame(loop)
    }

    private stop(): void {
        if (this.rafHandle != null) {
            cancelAnimationFrame(this.rafHandle)
            this.rafHandle = null
        }
        if (this.ctx) this.ctx.clearRect(0, 0, this.width, this.height)
    }

    private step(dt: number): void {
        if (!this.ctx) return
        const ctx = this.ctx
        const gravity = this.gravity
        ctx.clearRect(0, 0, this.width, this.height)
        const next: Particle[] = []
        for (const p of this.particles) {
            p.life += dt * 1000
            p.vy += gravity * dt
            p.x += p.vx * dt
            p.y += p.vy * dt
            const t = p.life / p.maxLife
            if (t >= 1) continue
            const alpha = 1 - t
            ctx.fillStyle = p.color
            ctx.globalAlpha = alpha
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
            next.push(p)
        }
        ctx.globalAlpha = 1
        this.particles = next
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ParticleEmitter)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ParticleEmitter
    }
}
