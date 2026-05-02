import { html } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ParticleEmitter.styles.js'

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }

@customElement('gc-particle-emitter')
export class ParticleEmitter extends GameElement {
    static styles = styles

    @property() burst = ''
    @property({ type: Number }) count = 24
    @property({ type: Array }) colors: string[] = ['#ffd35a']
    @property({ type: Number, attribute: 'particle-size' }) particleSize = 4
    @property({ type: Number }) speed = 120
    @property({ type: Number }) lifetime = 800
    @property({ type: Number }) gravity = 200
    @property({ type: Number }) width = 200
    @property({ type: Number }) height = 200

    @query('canvas') private _canvas!: HTMLCanvasElement

    private _particles: Particle[] = []
    private _raf = 0
    private _lastBurst = ''

    connectedCallback(): void {
        super.connectedCallback()
        this._loop()
    }
    disconnectedCallback(): void { if (this._raf) cancelAnimationFrame(this._raf); super.disconnectedCallback() }

    updated(): void {
        if (this.burst && this.burst !== this._lastBurst) {
            this._lastBurst = this.burst
            this._spawn()
        }
    }

    private _spawn(): void {
        const cx = this.width / 2, cy = this.height / 2
        for (let i = 0; i < this.count; i++) {
            const angle = Math.random() * Math.PI * 2
            const v = this.speed * (0.6 + Math.random() * 0.4)
            this._particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * v,
                vy: Math.sin(angle) * v,
                life: 0,
                max: this.lifetime / 1000,
                size: this.particleSize * (0.6 + Math.random() * 0.8),
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
            })
        }
    }

    private _loop = (): void => {
        const ctx = this._canvas?.getContext('2d')
        if (ctx) {
            ctx.clearRect(0, 0, this.width, this.height)
            const dt = 1 / 60
            const next: Particle[] = []
            for (const p of this._particles) {
                p.life += dt
                if (p.life >= p.max) continue
                p.vy += this.gravity * dt
                p.x += p.vx * dt
                p.y += p.vy * dt
                const alpha = 1 - p.life / p.max
                ctx.fillStyle = p.color
                ctx.globalAlpha = alpha
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                ctx.fill()
                next.push(p)
            }
            ctx.globalAlpha = 1
            this._particles = next
        }
        this._raf = requestAnimationFrame(this._loop)
    }

    render() { return html`<canvas width=${this.width} height=${this.height}></canvas>` }
}
