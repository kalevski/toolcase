import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-metric-tile'

function resolveIcon(name: string): string {
    const svgStr = (LucideIcons as Record<string, string>)[name]
    return svgStr ? icon(svgStr, 'tc-metric-tile-icon-svg') : ''
}

export class MetricTile extends HTMLElement {
    private _initialised = false
    private _hintSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['label', 'value', 'unit', 'icon', 'hint']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        setAttr(this, 'label', v)
    }

    get value(): string | null {
        return this.getAttribute('value')
    }
    set value(v: string | null) {
        if (v != null) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get unit(): string | null {
        return this.getAttribute('unit')
    }
    set unit(v: string | null) {
        if (v != null) this.setAttribute('unit', v)
        else this.removeAttribute('unit')
    }

    // Note: 'icon' getter/setter is safe — HTMLElement does not expose an 'icon' property.
    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get hint(): string | null {
        return this.getAttribute('hint')
    }
    set hint(v: string | null) {
        if (v != null) this.setAttribute('hint', v)
        else this.removeAttribute('hint')
    }

    private render(): void {
        const label = this.getAttribute('label') ?? ''
        const value = this.getAttribute('value')
        const unit = this.getAttribute('unit')
        const iconName = this.getAttribute('icon')
        const hint = this.getAttribute('hint')

        const iconSvg = iconName ? resolveIcon(iconName) : ''
        const iconHtml = iconSvg
            ? `<span class="tc-metric-tile-icon" aria-hidden="true">${iconSvg}</span>`
            : ''

        const unitHtml = unit ? `<span class="tc-metric-tile-unit">${esc(unit)}</span>` : ''

        // When value attr is set, put text directly in .tc-metric-tile-value.
        // When absent, leave empty — slot children are distributed after render.
        const valueContent = value !== null ? esc(value) : ''
        const valueHtml = [
            '<div class="tc-metric-tile-value-row">',
            `<span class="tc-metric-tile-value">${valueContent}</span>`,
            unitHtml,
            '</div>',
        ].join('')

        const hintHtml =
            hint !== null ? `<span class="tc-metric-tile-hint">${esc(hint)}</span>` : ''

        // THE HOST IS THE TILE — a two-column grid. The label, value and hint are
        // element-owned; a rich value or a `slot="hint"` child the consumer wrote
        // keeps its place in their own markup and is positioned by CSS (rule 1).
        setHostClass(this, 'tc-metric-tile')
        patchHtml(
            this,
            [
                iconHtml,
                `<span class="tc-metric-tile-label">${esc(label)}</span>`,
                value !== null ? valueHtml : '',
                hintHtml,
            ].join(''),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MetricTile
    }
}
