import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-asset-row'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class AssetRow extends HTMLElement {
    private _initialised = false
    private _tags: string[] = []

    static get observedAttributes(): string[] {
        return ['icon', 'name', 'size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture named-slot children before render() wipes innerHTML
            const iconSlot = Array.from(this.querySelectorAll('[slot="icon"]'))
            const nameSlot = Array.from(this.querySelectorAll('[slot="name"]'))
            const sizeSlot = Array.from(this.querySelectorAll('[slot="size"]'))

            this.render()

            // Distribute named-slot children into their inner regions
            const iconEl = this.querySelector('.tc-asset-row-icon')
            if (iconEl) iconSlot.forEach(n => iconEl.appendChild(n))
            const nameEl = this.querySelector('.tc-asset-row-name')
            if (nameEl) nameSlot.forEach(n => nameEl.appendChild(n))
            const sizeEl = this.querySelector('.tc-asset-row-size')
            if (sizeEl) sizeSlot.forEach(n => sizeEl.appendChild(n))

            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get size(): string | null {
        return this.getAttribute('size')
    }
    set size(v: string | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    get tags(): string[] {
        return this._tags
    }
    set tags(v: string[]) {
        this._tags = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        // Re-capture slot children from within their containers before render wipes innerHTML
        const iconSlot = Array.from(this.querySelectorAll('.tc-asset-row-icon [slot="icon"]'))
        const nameSlot = Array.from(this.querySelectorAll('.tc-asset-row-name [slot="name"]'))
        const sizeSlot = Array.from(this.querySelectorAll('.tc-asset-row-size [slot="size"]'))

        this.render()

        const iconEl = this.querySelector('.tc-asset-row-icon')
        if (iconEl) iconSlot.forEach(n => iconEl.appendChild(n))
        const nameEl = this.querySelector('.tc-asset-row-name')
        if (nameEl) nameSlot.forEach(n => nameEl.appendChild(n))
        const sizeEl = this.querySelector('.tc-asset-row-size')
        if (sizeEl) sizeSlot.forEach(n => sizeEl.appendChild(n))
    }

    private _resolveIcon(name: string): string {
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (!svgStr) return ''
        return icon(svgStr)
    }

    private render(): void {
        const iconAttr = this.getAttribute('icon')
        const nameAttr = this.getAttribute('name')
        const sizeAttr = this.getAttribute('size')

        // Manage host layout classes without wiping user-added ones
        this.classList.add('tc-asset-row', 'd-flex', 'align-items-center')

        // Icon: attribute → inline lucide SVG; otherwise slot content appended after
        const iconHtml = iconAttr ? this._resolveIcon(iconAttr) : ''

        // Name: attribute → escaped text; otherwise slot content appended after
        const nameHtml = nameAttr != null ? esc(nameAttr) : ''

        // Tags: JS property → neutral slate chip badges
        const tagsHtml = this._tags.length > 0
            ? `<span class="tc-asset-row-tags">${this._tags.map(t => `<span class="tc-asset-row-tag">${esc(t)}</span>`).join('')}</span>`
            : ''

        // Size: attribute → escaped text; otherwise slot content appended after
        const sizeHtml = sizeAttr != null ? esc(sizeAttr) : ''

        this.innerHTML =
            `<span class="tc-asset-row-icon" aria-hidden="true">${iconHtml}</span>` +
            `<span class="tc-asset-row-name">${nameHtml}</span>` +
            tagsHtml +
            `<span class="tc-asset-row-size">${sizeHtml}</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AssetRow
    }
}
