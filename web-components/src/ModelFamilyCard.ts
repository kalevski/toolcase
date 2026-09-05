import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'

const TAG_NAME = 'tc-model-family-card'

// Body-type enum → lucide icon + humanized label. Members mirror the vehicle
// catalog's `body_type` Postgres enum; an unknown/absent value renders nothing
// (the schema's "unknown is NULL" rule — no sentinel chip).
const BODY_TYPES: Record<string, { icon: string; label: string }> = {
    BUS: { icon: 'bus', label: 'Bus' },
    CONVERTIBLE: { icon: 'car', label: 'Convertible' },
    COUPE: { icon: 'car', label: 'Coupe' },
    HATCHBACK: { icon: 'car', label: 'Hatchback' },
    HIGH_ROOF_ESTATE: { icon: 'car', label: 'High-roof estate' },
    MOTORHOME: { icon: 'caravan', label: 'Motorhome' },
    NOTCHBACK: { icon: 'car', label: 'Notchback' },
    OFF_ROAD_VEHICLE: { icon: 'mountain', label: 'Off-road vehicle' },
    PICKUP_TRUCK: { icon: 'truck', label: 'Pickup truck' },
    ROADSTER: { icon: 'car', label: 'Roadster' },
    SUV: { icon: 'car-front', label: 'SUV' },
    ESTATE: { icon: 'car', label: 'Estate' },
    TRANSPORTER: { icon: 'truck', label: 'Transporter' },
    VAN: { icon: 'truck', label: 'Van' },
}

// tc-model-family-card — a card for one row of the vehicle catalog's
// `model_family` table (manufacturer + range/series/generation + body type).
// The signature is the lineage line: the manufacturer as a muted eyebrow, the
// range as the human-readable title, and below it a machine-facing mono
// breadcrumb "RANGE / SERIES / GENERATION" (structure is mono; prose is
// Inter). The meta row carries the body-type chip (lucide icon + humanized
// enum label), a mono years span and a variant count. An optional photo strip
// (`image-src`) caps the card; `href` links the title.
export class ModelFamilyCard extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return [
            'manufacturer',
            'range',
            'series',
            'generation',
            'body-type',
            'years-text',
            'variant-count-text',
            'href',
            'image-src',
            'image-alt',
        ]
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

    // ── Rendering ────────────────────────────────────────────────────────────

    private _lineageHtml(range: string, series: string, generation: string): string {
        const parts = [range, series, generation].filter(Boolean)
        if (parts.length === 0) return ''
        const inner = parts
            .map((p) => `<span class="tc-model-family-card-lineage-part">${esc(p)}</span>`)
            .join('<span class="tc-model-family-card-lineage-sep" aria-hidden="true">/</span>')
        return `<div class="tc-model-family-card-lineage">${inner}</div>`
    }

    private _bodyTypeHtml(): string {
        const raw = this.getAttribute('body-type')
        if (!raw) return ''
        const entry = BODY_TYPES[raw.trim().toUpperCase()]
        if (!entry) return ''
        const iconHtml = lucideByName(entry.icon, 'tc-model-family-card-chip-icon-svg')
        return (
            `<span class="tc-model-family-card-chip">` +
            `<span class="tc-model-family-card-chip-icon">${iconHtml}</span>` +
            `<span class="tc-model-family-card-chip-label">${esc(entry.label)}</span>` +
            `</span>`
        )
    }

    private render(): void {
        const manufacturer = this.getAttribute('manufacturer')
        const range = this.getAttribute('range') ?? ''
        const series = this.getAttribute('series') ?? ''
        const generation = this.getAttribute('generation') ?? ''
        const yearsText = this.getAttribute('years-text')
        const variantCountText = this.getAttribute('variant-count-text')
        const href = this.getAttribute('href')
        const imageSrc = this.getAttribute('image-src')
        const imageAlt = this.getAttribute('image-alt') ?? ''

        const mediaHtml = imageSrc
            ? `<div class="tc-model-family-card-media">` +
              `<img class="tc-model-family-card-img" src="${esc(imageSrc)}" alt="${esc(imageAlt)}" loading="lazy" />` +
              `</div>`
            : ''

        const titleHtml = href
            ? `<a class="tc-model-family-card-title" href="${esc(href)}">${esc(range)}</a>`
            : `<span class="tc-model-family-card-title">${esc(range)}</span>`

        const metaParts = [
            this._bodyTypeHtml(),
            yearsText ? `<span class="tc-model-family-card-years">${esc(yearsText)}</span>` : '',
            variantCountText
                ? `<span class="tc-model-family-card-count">${esc(variantCountText)}</span>`
                : '',
        ].filter(Boolean)
        const metaHtml = metaParts.length
            ? `<div class="tc-model-family-card-meta">${metaParts.join('')}</div>`
            : ''

        patchHtml(
            this,
            `<article class="tc-model-family-card">` +
                mediaHtml +
                `<div class="tc-model-family-card-body">` +
                (manufacturer
                    ? `<span class="tc-model-family-card-eyebrow">${esc(manufacturer)}</span>`
                    : '') +
                titleHtml +
                this._lineageHtml(range, series, generation) +
                metaHtml +
                `</div>` +
                `</article>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ModelFamilyCard
    }
}
