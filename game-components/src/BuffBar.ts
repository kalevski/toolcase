const TAG_NAME = 'gc-buff-bar'

export interface BuffEntry {
    id: string
    icon?: string
    name?: string
    remaining?: number
    duration?: number
    stacks?: number
    debuff?: boolean
}

export class BuffBar extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['icon-size', 'gap']
    }

    private _buffs: BuffEntry[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get buffs(): BuffEntry[] {
        return this._buffs.slice()
    }
    set buffs(values: BuffEntry[]) {
        this._buffs = Array.isArray(values) ? values.slice() : []
        if (this.isConnected) this.render()
    }

    get iconSize(): number {
        const raw = this.getAttribute('icon-size')
        if (raw == null) return 36
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 36 : parsed
    }
    set iconSize(v: number) {
        this.setAttribute('icon-size', String(v))
    }

    get gap(): string {
        return this.getAttribute('gap') ?? '6px'
    }
    set gap(v: string) {
        this.setAttribute('gap', v)
    }

    private formatTime(remaining: number): string {
        if (!Number.isFinite(remaining) || remaining <= 0) return ''
        if (remaining >= 60) {
            const m = Math.floor(remaining / 60)
            const s = Math.floor(remaining % 60)
            return `${m}m${s ? ` ${s}s` : ''}`
        }
        return `${Math.ceil(remaining)}s`
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const iconSize = this.iconSize
        this.style.setProperty('--gc-buff-bar-gap', this.gap)
        const items = this._buffs.map(b => {
            const kind = b.debuff ? 'debuff' : 'buff'
            const time = b.remaining != null ? this.formatTime(b.remaining) : ''
            const stacks = b.stacks != null && b.stacks > 1
                ? `<span class="gc-buff-bar-stack">×${b.stacks}</span>`
                : ''
            const cooldownPct = b.remaining != null && b.duration && b.duration > 0
                ? Math.max(0, Math.min(1, b.remaining / b.duration))
                : null
            const overlay = cooldownPct != null
                ? `<div class="gc-buff-bar-cooldown" style="--cd: ${(1 - cooldownPct) * 360}deg"></div>`
                : ''
            return `
                <div class="gc-buff-bar-cell" data-id="${this.escape(b.id)}">
                    <gc-buff-icon
                        kind="${kind}"
                        glyph="${this.escape(b.icon ?? '')}"
                        time="${this.escape(time)}"
                        size="${iconSize}"
                    ></gc-buff-icon>
                    ${overlay}
                    ${stacks}
                </div>
            `
        }).join('')
        this.innerHTML = `<div class="gc-buff-bar-row">${items}</div>`
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, BuffBar)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BuffBar
    }
}
