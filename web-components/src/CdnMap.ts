const TAG_NAME = 'tc-cdn-map'

export type CdnMapVariant = 'primary' | 'accent'

export interface CdnMapNode {
    top: string
    left: string
    variant?: CdnMapVariant
    label?: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// Pure-number string → "Npx"; any other CSS string passes through unchanged.
function resolveLength(raw: string | null, fallback: string): string {
    if (raw === null) return fallback
    return /^\d+(\.\d+)?$/.test(raw.trim()) ? `${raw.trim()}px` : raw
}

export class CdnMap extends HTMLElement {
    private _initialised = false
    private _nodes: CdnMapNode[] = []

    static get observedAttributes(): string[] {
        return ['height']
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

    get nodes(): CdnMapNode[] {
        return this._nodes
    }
    set nodes(v: CdnMapNode[]) {
        this._nodes = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get height(): string | null {
        return this.getAttribute('height')
    }
    set height(v: string | null) {
        if (v != null) this.setAttribute('height', v)
        else this.removeAttribute('height')
    }

    private render(): void {
        const heightCss = resolveLength(this.getAttribute('height'), '360px')

        const primaryCount = this._nodes.filter(n => n.variant !== 'accent').length
        const accentCount = this._nodes.filter(n => n.variant === 'accent').length
        const ariaLabel = this._nodes.length === 0
            ? 'CDN map — no nodes'
            : `CDN map — ${primaryCount} primary node${primaryCount !== 1 ? 's' : ''}, ${accentCount} accent node${accentCount !== 1 ? 's' : ''}`

        const nodeHtml = this._nodes.map(node => {
            const isAccent = node.variant === 'accent'
            const variantClass = isAccent ? ' is-accent' : ' is-primary'
            const variantLabel = isAccent ? 'accent' : 'primary'
            const rawLabel = node.label || ''
            const labelHtml = rawLabel ? `<span class="tc-cdn-map__node-label">${esc(rawLabel)}</span>` : ''
            const nodeAriaLabel = rawLabel ? `${rawLabel} (${variantLabel})` : variantLabel
            return `<span class="tc-cdn-map__node${variantClass}" style="top:${esc(node.top)};left:${esc(node.left)}" role="img" aria-label="${esc(nodeAriaLabel)}"><span class="tc-cdn-map__node-dot" aria-hidden="true"></span>${labelHtml}</span>`
        }).join('')

        this.classList.add('tc-cdn-map')
        this.setAttribute('role', 'img')
        this.setAttribute('aria-label', ariaLabel)
        this.style.height = heightCss

        this.innerHTML = `<div class="tc-cdn-map__grid" aria-hidden="true"></div>${nodeHtml}`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CdnMap
    }
}
