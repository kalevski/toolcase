import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-colored-card'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function resolveIcon(name: string): string {
    const svg = (LucideIcons as Record<string, string>)[name]
    return svg ? icon(svg, 'tc-colored-card-icon-svg') : ''
}

export class ColoredCard extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['text', 'value', 'icon', 'color', 'loading']
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

    get text(): string {
        return this.getAttribute('text') ?? ''
    }
    set text(v: string) {
        this.setAttribute('text', v)
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string | number) {
        this.setAttribute('value', String(v))
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get color(): string | null {
        return this.getAttribute('color')
    }
    set color(v: string | null) {
        if (v != null) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    private render(): void {
        const loading = this.loading
        const color = this.getAttribute('color')

        // Inline --bs-colored-card-accent so the SCSS tint and glyph color pick it up.
        if (color) {
            this.style.setProperty('--bs-colored-card-accent', color)
        } else {
            this.style.removeProperty('--bs-colored-card-accent')
        }

        if (loading) {
            this.setAttribute('aria-busy', 'true')
            this.innerHTML = [
                '<div class="card tc-colored-card">',
                '<div class="card-body tc-colored-card-body">',
                '<div class="tc-colored-card-icon tc-colored-card-icon--skeleton" aria-hidden="true"></div>',
                '<div class="tc-colored-card-content">',
                '<div class="tc-colored-card-skeleton tc-colored-card-skeleton--value"></div>',
                '<div class="tc-colored-card-skeleton tc-colored-card-skeleton--text"></div>',
                '</div>',
                '</div>',
                '<span class="visually-hidden" role="status">Loading…</span>',
                '</div>',
            ].join('')
        } else {
            this.removeAttribute('aria-busy')
            const iconName = this.getAttribute('icon')
            const iconSvg = iconName ? resolveIcon(iconName) : ''
            const iconChipHtml = iconSvg
                ? `<div class="tc-colored-card-icon" aria-hidden="true">${iconSvg}</div>`
                : ''

            this.innerHTML = [
                '<div class="card tc-colored-card">',
                '<div class="card-body tc-colored-card-body">',
                iconChipHtml,
                '<div class="tc-colored-card-content">',
                `<span class="tc-colored-card-value">${esc(this.getAttribute('value') ?? '')}</span>`,
                `<span class="tc-colored-card-text">${esc(this.getAttribute('text') ?? '')}</span>`,
                '</div>',
                '</div>',
                '</div>',
            ].join('')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ColoredCard
    }
}
