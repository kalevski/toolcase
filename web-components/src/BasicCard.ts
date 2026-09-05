import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-basic-card'

function resolveIcon(name: string): string {
    const svg = (LucideIcons as Record<string, string>)[name]
    return svg ? icon(svg, 'tc-basic-card-icon-svg') : ''
}

export class BasicCard extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        // `value` / `text` are the legacy tc-colored-card attribute names, accepted
        // as aliases of `text-a` / `text-b`; `color` drives the accent-tinted chip.
        return ['text-a', 'text-b', 'icon', 'loading', 'color', 'value', 'text']
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

    get textA(): string {
        return this.getAttribute('text-a') ?? this.getAttribute('value') ?? ''
    }
    set textA(v: string) {
        setAttr(this, 'text-a', v)
    }

    get textB(): string {
        return this.getAttribute('text-b') ?? this.getAttribute('text') ?? ''
    }
    set textB(v: string) {
        setAttr(this, 'text-b', v)
    }

    get color(): string | null {
        return this.getAttribute('color')
    }
    set color(v: string | null) {
        if (v != null) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
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

        // Inline --bs-basic-card-accent so the SCSS tint + glyph color pick it up;
        // the `--accent` modifier switches the icon chip to the tinted treatment.
        if (color) this.style.setProperty('--bs-basic-card-accent', color)
        else this.style.removeProperty('--bs-basic-card-accent')
        const rootClass = color ? 'card tc-basic-card tc-basic-card--accent' : 'card tc-basic-card'

        if (loading) {
            this.setAttribute('aria-busy', 'true')
            patchHtml(
                this,
                [
                    `<div class="${rootClass}">`,
                    '<div class="card-body tc-basic-card-body">',
                    '<div class="tc-basic-card-icon tc-basic-card-icon--skeleton" aria-hidden="true"></div>',
                    '<div class="tc-basic-card-text">',
                    '<div class="tc-basic-card-skeleton tc-basic-card-skeleton--primary"></div>',
                    '<div class="tc-basic-card-skeleton tc-basic-card-skeleton--secondary"></div>',
                    '</div>',
                    '</div>',
                    '<span class="visually-hidden" role="status">Loading…</span>',
                    '</div>',
                ].join(''),
            )
        } else {
            this.removeAttribute('aria-busy')
            const iconName = this.getAttribute('icon')
            const iconSvg = iconName ? resolveIcon(iconName) : ''
            const iconChipHtml = iconSvg
                ? `<div class="tc-basic-card-icon" aria-hidden="true">${iconSvg}</div>`
                : ''

            patchHtml(
                this,
                [
                    `<div class="${rootClass}">`,
                    '<div class="card-body tc-basic-card-body">',
                    iconChipHtml,
                    '<div class="tc-basic-card-text">',
                    `<span class="tc-basic-card-primary">${esc(this.textA)}</span>`,
                    `<span class="tc-basic-card-secondary">${esc(this.textB)}</span>`,
                    '</div>',
                    '</div>',
                    '</div>',
                ].join(''),
            )
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BasicCard
    }
}
