import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-metric-tile'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

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
        if (!this._initialised) {
            // Capture named hint-slot children before render() wipes innerHTML.
            this._hintSlotNodes = Array.from(this.querySelectorAll('[slot="hint"]'))
            // Capture default slot children (value) — exclude hint-slot nodes.
            const valueNodes = !this.hasAttribute('value')
                ? Array.from(this.childNodes).filter(
                      n => !(n instanceof Element && n.getAttribute('slot') === 'hint')
                  )
                : []

            this.render()

            // Distribute default (value) slot into .tc-metric-tile-value when no value attr.
            if (!this.hasAttribute('value')) {
                const valueEl = this.querySelector('.tc-metric-tile-value')
                if (valueEl) valueNodes.forEach(n => valueEl.appendChild(n))
            }
            // Distribute hint-slot nodes into .tc-metric-tile-hint when no hint attr.
            if (!this.hasAttribute('hint')) {
                const hintEl = this.querySelector('.tc-metric-tile-hint')
                if (hintEl) this._hintSlotNodes.forEach(n => hintEl.appendChild(n))
            }

            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return

        // Re-capture hint slot nodes from their current inner container.
        const hintEl = this.querySelector('.tc-metric-tile-hint')
        if (hintEl) {
            const inHint = Array.from(hintEl.querySelectorAll('[slot="hint"]'))
            if (inHint.length > 0) this._hintSlotNodes = inHint
        }

        // Re-capture value slot nodes from the value element.
        // When value attr was set, .tc-metric-tile-value holds attr text — capture is benign
        // (nothing will be redistributed since hasAttribute('value') will be true after).
        const valueEl = this.querySelector('.tc-metric-tile-value')
        const valueNodes = valueEl ? Array.from(valueEl.childNodes) : []

        this.render()

        if (!this.hasAttribute('value')) {
            const newValueEl = this.querySelector('.tc-metric-tile-value')
            if (newValueEl) valueNodes.forEach(n => newValueEl.appendChild(n))
        }
        if (!this.hasAttribute('hint')) {
            const newHintEl = this.querySelector('.tc-metric-tile-hint')
            if (newHintEl) this._hintSlotNodes.forEach(n => newHintEl.appendChild(n))
        }
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        this.setAttribute('label', v)
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

        const unitHtml = unit
            ? `<span class="tc-metric-tile-unit">${esc(unit)}</span>`
            : ''

        // When value attr is set, put text directly in .tc-metric-tile-value.
        // When absent, leave empty — slot children are distributed after render.
        const valueContent = value !== null ? esc(value) : ''
        const valueHtml = [
            '<div class="tc-metric-tile-value-row">',
            `<span class="tc-metric-tile-value">${valueContent}</span>`,
            unitHtml,
            '</div>',
        ].join('')

        // Render hint element if hint attr is set or hint slot nodes were captured.
        const showHint = hint !== null || this._hintSlotNodes.length > 0
        const hintHtml = showHint
            ? `<span class="tc-metric-tile-hint">${hint !== null ? esc(hint) : ''}</span>`
            : ''

        this.innerHTML = [
            '<div class="tc-metric-tile">',
            iconHtml,
            '<div class="tc-metric-tile-body">',
            `<span class="tc-metric-tile-label">${esc(label)}</span>`,
            valueHtml,
            hintHtml,
            '</div>',
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MetricTile
    }
}
