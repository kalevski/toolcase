const TAG_NAME = 'tc-logo-cloud'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export interface LogoCloudLogo {
    src: string
    alt: string
    href?: string
    width?: number
}

export class LogoCloud extends HTMLElement {
    private _initialised = false
    private _logos: LogoCloudLogo[] = []

    static get observedAttributes(): string[] {
        return ['title', 'grayscale', 'columns']
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

    get logos(): LogoCloudLogo[] {
        return this._logos
    }
    set logos(v: LogoCloudLogo[]) {
        this._logos = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get grayscale(): boolean {
        return this.hasAttribute('grayscale')
    }
    set grayscale(v: boolean) {
        if (v) this.setAttribute('grayscale', '')
        else this.removeAttribute('grayscale')
    }

    get columns(): number {
        const raw = this.getAttribute('columns')
        if (raw === null) return 5
        const n = parseInt(raw, 10)
        return isNaN(n) || n < 1 ? 5 : n
    }
    set columns(v: number) {
        this.setAttribute('columns', String(v))
    }

    private render(): void {
        this.classList.add('tc-logo-cloud')
        this.classList.toggle('tc-logo-cloud--grayscale', this.grayscale)
        this.style.setProperty('--bs-logo-cloud-columns', String(this.columns))

        const titleAttr = this.getAttribute('title')
        const titleHtml = titleAttr
            ? `<h2 class="tc-logo-cloud__title">${esc(titleAttr)}</h2>`
            : ''

        const logosHtml = this._logos.map(logo => {
            let widthStyle = ''
            if (logo.width != null) {
                widthStyle = ` style="width:${esc(String(logo.width))}px"`
            }
            const imgHtml = `<img class="tc-logo-cloud-img" src="${esc(logo.src)}" alt="${esc(logo.alt)}"${widthStyle} loading="lazy">`

            if (logo.href) {
                return (
                    `<a class="tc-logo-cloud-cell tc-logo-cloud-cell--linked" ` +
                    `href="${esc(logo.href)}" target="_blank" rel="noopener noreferrer">` +
                    `${imgHtml}` +
                    `<span class="visually-hidden">(opens in new tab)</span>` +
                    `</a>`
                )
            }
            return `<span class="tc-logo-cloud-cell">${imgHtml}</span>`
        }).join('')

        this.innerHTML =
            `${titleHtml}` +
            `<div class="tc-logo-cloud-grid">${logosHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LogoCloud
    }
}
