import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-basic-card'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function resolveIcon(name: string): string {
    const svg = (LucideIcons as Record<string, string>)[name]
    return svg ? icon(svg, 'tc-basic-card-icon-svg') : ''
}

export class BasicCard extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['text-a', 'text-b', 'icon', 'loading']
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
        return this.getAttribute('text-a') ?? ''
    }
    set textA(v: string) {
        this.setAttribute('text-a', v)
    }

    get textB(): string {
        return this.getAttribute('text-b') ?? ''
    }
    set textB(v: string) {
        this.setAttribute('text-b', v)
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

        if (loading) {
            this.setAttribute('aria-busy', 'true')
            this.innerHTML = [
                '<div class="card tc-basic-card">',
                '<div class="card-body tc-basic-card-body">',
                '<div class="tc-basic-card-icon tc-basic-card-icon--skeleton" aria-hidden="true"></div>',
                '<div class="tc-basic-card-text">',
                '<div class="tc-basic-card-skeleton tc-basic-card-skeleton--primary"></div>',
                '<div class="tc-basic-card-skeleton tc-basic-card-skeleton--secondary"></div>',
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
                ? `<div class="tc-basic-card-icon" aria-hidden="true">${iconSvg}</div>`
                : ''

            this.innerHTML = [
                '<div class="card tc-basic-card">',
                '<div class="card-body tc-basic-card-body">',
                iconChipHtml,
                '<div class="tc-basic-card-text">',
                `<span class="tc-basic-card-primary">${esc(this.textA)}</span>`,
                `<span class="tc-basic-card-secondary">${esc(this.textB)}</span>`,
                '</div>',
                '</div>',
                '</div>',
            ].join('')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BasicCard
    }
}
