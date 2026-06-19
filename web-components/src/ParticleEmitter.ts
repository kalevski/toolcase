const TAG_NAME = 'tc-particle-emitter'

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

// TC palette defaults: slate-900, slate-600, cyan accent, slate-300
const DEFAULT_COLORS = ['#0f172a', '#475569', '#22d3ee', '#cbd5e1']

export class ParticleEmitter extends HTMLElement {
    private _canvas: HTMLCanvasElement | null = null
    private _ctx: CanvasRenderingContext2D | null = null
    private _particles: Particle[] = []
    private _rafHandle: number | null = null
    private _lastBurst: string | null = null
    private _colors: string[] = DEFAULT_COLORS.slice()

    onBurst: ((count: number) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'burst',
            'count',
            'particle-size',
            'speed',
            'lifetime',
            'gravity',
            'width',
            'height',
        ]
    }

    connectedCallback(): void {
        this.render()
        this._lastBurst = this.getAttribute('burst')
    }

    disconnectedCallback(): void {
        this.stop()
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected) return
        if (name === 'burst' && next !== this._lastBurst) {
            this._lastBurst = next
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
        this.innerHTML = `<canvas class="tc-particle-emitter__canvas" width="${w}" height="${h}" aria-hidden="true"></canvas>`
        this._canvas = this.querySelector('canvas')
        this._ctx = this._canvas?.getContext('2d') ?? null
    }

    private spawnBurst(): void {
        if (!this._canvas) this.render()
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
            this._particles.push({
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
        this.dispatchEvent(
            new CustomEvent('tc-burst', {
                bubbles: true,
                composed: true,
                detail: { count },
            }),
        )
        if (typeof this.onBurst === 'function') this.onBurst(count)
        // Skip the animation loop when the user has requested reduced motion
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.startLoop()
        }
    }

    private startLoop(): void {
        if (this._rafHandle != null) return
        let lastT = performance.now()
        const loop = (now: number) => {
            const dt = Math.min(0.05, (now - lastT) / 1000)
            lastT = now
            this.step(dt)
            if (this._particles.length === 0) {
                this.stop()
                return
            }
            this._rafHandle = requestAnimationFrame(loop)
        }
        this._rafHandle = requestAnimationFrame(loop)
    }

    private stop(): void {
        if (this._rafHandle != null) {
            cancelAnimationFrame(this._rafHandle)
            this._rafHandle = null
        }
        if (this._ctx && this._canvas) {
            this._ctx.clearRect(0, 0, this.width, this.height)
        }
        this._particles = []
    }

    private step(dt: number): void {
        if (!this._ctx || !this._canvas) return
        const ctx = this._ctx
        const gravity = this.gravity
        ctx.clearRect(0, 0, this.width, this.height)
        const next: Particle[] = []
        for (const p of this._particles) {
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
        this._particles = next
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ParticleEmitter
    }
}
