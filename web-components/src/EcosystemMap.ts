import { esc } from './internal/esc'
const TAG_NAME = 'tc-ecosystem-map'

export interface EcosystemNode {
    name: string
    href?: string
    accent?: string
}

export interface EcosystemRing {
    label?: string
    items: EcosystemNode[]
}

export interface EcosystemCore {
    name: string
    label?: string
}

const DEFAULT_SIZE = 480

export class EcosystemMap extends HTMLElement {
    private _initialised = false
    private _core: EcosystemCore = { name: '' }
    private _rings: EcosystemRing[] = []
    private _titleSlotNodes: Node[] = []

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element
        const nodeEl = target.closest('[data-em-id]')
        if (!nodeEl) return
        const id = (nodeEl as HTMLElement).dataset.emId ?? ''
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { id },
            }),
        )
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const target = e.target as Element
        const nodeEl = target.closest('[data-em-id]')
        if (!nodeEl) return
        e.preventDefault()
        ;(nodeEl as HTMLElement).click()
    }

    static get observedAttributes(): string[] {
        return ['size', 'title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('title')) {
                this._titleSlotNodes = Array.from(this.querySelectorAll('[slot="title"]'))
            }
            this.render()
            this._distributeSlots()
            this._initialised = true
        }
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get core(): EcosystemCore {
        return this._core
    }
    set core(v: EcosystemCore) {
        this._core = v && typeof v === 'object' && !Array.isArray(v) ? v : { name: '' }
        if (this._initialised) this._rerenderWithSlots()
    }

    get rings(): EcosystemRing[] {
        return this._rings
    }
    set rings(v: EcosystemRing[]) {
        this._rings = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get size(): number {
        return parseInt(this.getAttribute('size') ?? String(DEFAULT_SIZE), 10) || DEFAULT_SIZE
    }
    set size(v: number) {
        this.setAttribute('size', String(v))
    }

    // title: HTMLElement already reflects the title attribute natively.
    // No getter/setter — read via getAttribute('title') in render().

    private _recaptureSlots(): void {
        if (!this.hasAttribute('title')) {
            const container = this.querySelector('.tc-ecosystem-map__title-slot')
            if (container) {
                const nodes = Array.from(container.querySelectorAll('[slot="title"]'))
                if (nodes.length > 0) this._titleSlotNodes = nodes
            }
        }
    }

    private _distributeSlots(): void {
        if (this._titleSlotNodes.length > 0 && !this.hasAttribute('title')) {
            const container = this.querySelector('.tc-ecosystem-map__title-slot')
            if (container) this._titleSlotNodes.forEach((n) => container.appendChild(n))
        }
    }

    private _rerenderWithSlots(): void {
        this._recaptureSlots()
        this.render()
        this._distributeSlots()
    }

    private render(): void {
        const size = this.size
        const cx = size / 2
        const cy = size / 2
        const titleAttr = this.getAttribute('title')
        const rings = this._rings
        const core = this._core

        const totalNodes = rings.reduce((sum, r) => sum + r.items.length, 0)
        const ariaLabel = core.name
            ? `Ecosystem map: ${core.name}${rings.length > 0 ? `, ${rings.length} ring${rings.length !== 1 ? 's' : ''}, ${totalNodes} node${totalNodes !== 1 ? 's' : ''}` : ''}`
            : 'Ecosystem map'

        let titleHtml = ''
        if (titleAttr) {
            titleHtml = `<h3 class="tc-ecosystem-map__title">${esc(titleAttr)}</h3>`
        } else if (this._titleSlotNodes.length > 0) {
            titleHtml = `<div class="tc-ecosystem-map__title-slot"></div>`
        }

        const coreRadius = Math.max(28, size * 0.075)
        const maxRingRadius = size * 0.435
        const nodeRadius = 10

        let ringsSvg = ''
        let connectorsSvg = ''
        let nodesSvg = ''

        if (rings.length > 0) {
            rings.forEach((ring, ri) => {
                const t = (ri + 1) / rings.length
                const ringRadius = coreRadius + (maxRingRadius - coreRadius) * t

                ringsSvg += `<circle class="tc-ecosystem-map__ring-circle" cx="${cx}" cy="${cy}" r="${ringRadius.toFixed(1)}" />`

                ring.items.forEach((node, ni) => {
                    const count = Math.max(ring.items.length, 1)
                    const angle = (ni / count) * Math.PI * 2 - Math.PI / 2
                    const nx = cx + ringRadius * Math.cos(angle)
                    const ny = cy + ringRadius * Math.sin(angle)

                    const cEdgeX = cx + coreRadius * Math.cos(angle)
                    const cEdgeY = cy + coreRadius * Math.sin(angle)
                    connectorsSvg += `<line class="tc-ecosystem-map__connector" x1="${cEdgeX.toFixed(1)}" y1="${cEdgeY.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" />`

                    const cosA = Math.cos(angle)
                    const sinA = Math.sin(angle)
                    const labelOffset = nodeRadius + 12
                    const lx = nx + cosA * labelOffset
                    const ly = ny + sinA * labelOffset
                    const textAnchor = cosA > 0.3 ? 'start' : cosA < -0.3 ? 'end' : 'middle'

                    const nodeId = esc(`${ri}-${ni}-${node.name}`)
                    const accentStyle = node.accent
                        ? ` style="--em-node-accent:${esc(node.accent)}"`
                        : ''

                    if (node.href) {
                        nodesSvg += `<a class="tc-ecosystem-map__node-link" href="${esc(node.href)}" target="_blank" rel="noopener noreferrer" data-em-id="${nodeId}"${accentStyle}><circle class="tc-ecosystem-map__node-dot" cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${nodeRadius}" /><text class="tc-ecosystem-map__node-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${textAnchor}" dominant-baseline="middle">${esc(node.name)}</text></a>`
                    } else {
                        nodesSvg += `<g class="tc-ecosystem-map__node-group" role="button" tabindex="0" aria-label="${esc(node.name)}" data-em-id="${nodeId}"${accentStyle}><circle class="tc-ecosystem-map__node-dot" cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="${nodeRadius}" /><text class="tc-ecosystem-map__node-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${textAnchor}" dominant-baseline="middle">${esc(node.name)}</text></g>`
                    }
                })
            })
        }

        const coreLabelDy = core.label ? '-0.55em' : '0.35em'
        const coreDisc = [
            `<circle class="tc-ecosystem-map__core-disc" cx="${cx}" cy="${cy}" r="${coreRadius.toFixed(1)}" />`,
            `<text class="tc-ecosystem-map__core-name" x="${cx}" y="${cy}" dy="${coreLabelDy}" text-anchor="middle">${esc(core.name)}</text>`,
            core.label
                ? `<text class="tc-ecosystem-map__core-label" x="${cx}" y="${cy}" dy="0.85em" text-anchor="middle">${esc(core.label)}</text>`
                : '',
        ].join('')

        const coreListItem = core.name
            ? `<span class="tc-ecosystem-map__node tc-ecosystem-map__node--core">${esc(core.name)}</span>`
            : ''

        const ringListGroups = rings
            .map((ring, ri) => {
                const items = ring.items
                    .map((node) =>
                        node.href
                            ? `<a class="tc-ecosystem-map__node" href="${esc(node.href)}" target="_blank" rel="noopener noreferrer">${esc(node.name)}</a>`
                            : `<span class="tc-ecosystem-map__node">${esc(node.name)}</span>`,
                    )
                    .join('')
                return `<div class="tc-ecosystem-map__list-group"><span class="tc-ecosystem-map__list-label">${esc(ring.label ?? `Ring ${ri + 1}`)}</span><div class="tc-ecosystem-map__list-items">${items}</div></div>`
            })
            .join('')

        const listHtml = `<div class="tc-ecosystem-map__list"><div class="tc-ecosystem-map__list-group"><span class="tc-ecosystem-map__list-label">Core</span><div class="tc-ecosystem-map__list-items">${coreListItem}</div></div>${ringListGroups}</div>`

        this.classList.add('tc-ecosystem-map')

        this.innerHTML = [
            titleHtml,
            `<svg class="tc-ecosystem-map__svg" role="img" aria-label="${ariaLabel}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><title>${ariaLabel}</title>${ringsSvg}${connectorsSvg}${coreDisc}${nodesSvg}</svg>`,
            listHtml,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EcosystemMap
    }
}
