import { patchHtml } from './internal/patch-html'
import { escapeHtml } from './internal/resourceBar'
import { setAttr } from './internal/tc-element'

// Each entry composes a <tc-buff-icon>; both elements are registered together
// in register.ts (tc-buff-icon is defined first).

const TAG_NAME = 'tc-buff-bar'

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
    private _initialised = false
    private _buffs: BuffEntry[] = []

    static get observedAttributes(): string[] {
        return ['icon-size', 'gap']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // --- Public API (mirrors gc-buff-bar) ---

    get buffs(): BuffEntry[] {
        return this._buffs.slice()
    }
    set buffs(values: BuffEntry[]) {
        this._buffs = Array.isArray(values) ? values.slice() : []
        if (this._initialised) this.render()
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
        setAttr(this, 'gap', v)
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

    private render(): void {
        const iconSize = this.iconSize
        // gap is a free-form CSS length → inline custom property on the host.
        this.style.setProperty('--bs-buff-bar-gap', this.gap)

        const items = this._buffs
            .map((b) => {
                const kind = b.debuff ? 'debuff' : 'buff'
                const time = b.remaining != null ? this.formatTime(b.remaining) : ''
                const stacks =
                    b.stacks != null && b.stacks > 1
                        ? `<span class="tc-buff-bar__stack">×${escapeHtml(String(b.stacks))}</span>`
                        : ''
                // Cooldown sweep: the spent fraction dims the icon via a conic mask.
                const cooldownPct =
                    b.remaining != null && b.duration && b.duration > 0
                        ? Math.max(0, Math.min(1, b.remaining / b.duration))
                        : null
                const overlay =
                    cooldownPct != null
                        ? `<div class="tc-buff-bar__cooldown" style="--cd: ${((1 - cooldownPct) * 360).toFixed(2)}deg"></div>`
                        : ''
                const label = b.name
                    ? ` title="${escapeHtml(b.name)}" aria-label="${escapeHtml(b.name)}"`
                    : ''
                return (
                    `<div class="tc-buff-bar__cell" role="listitem" data-id="${escapeHtml(b.id)}"${label}>` +
                    `<tc-buff-icon kind="${kind}" glyph="${escapeHtml(b.icon ?? '')}" time="${escapeHtml(time)}" size="${iconSize}"></tc-buff-icon>` +
                    overlay +
                    stacks +
                    `</div>`
                )
            })
            .join('')

        patchHtml(this, `<div class="tc-buff-bar__row" role="list">${items}</div>`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BuffBar
    }
}
