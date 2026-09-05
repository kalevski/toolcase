import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-variant-spec-sheet'

// The full catalog row of the `model_variant` table, camelCase. Every field
// is optional — the schema's rule is "unknown is NULL", so an absent value
// skips its row entirely (never an em-dash placeholder).
export interface VariantSpec {
    powertrain?: string | null
    fuelType?: string | null
    gearboxType?: string | null
    gears?: number | null
    drivetrainType?: string | null
    powerPs?: number | null
    powerKw?: number | null
    seats?: number | null
    doors?: number | null
    frontSuspension?: string | null
    rearSuspension?: string | null
    frontBrakes?: string | null
    rearBrakes?: string | null
    frontTyre?: string | null
    rearTyre?: string | null
    fuelCapacityL?: number | null
    consumptionL100km?: number | null
    consumptionCityL100km?: number | null
    consumptionHwyL100km?: number | null
    emissionStandard?: string | null
    emissionCategory?: string | null
    co2GKm?: number | null
    adblueCapacityL?: number | null
    lengthMm?: number | null
    widthMm?: number | null
    heightMm?: number | null
    wheelbaseMm?: number | null
    turningCircleDm?: number | null
    trunkVolumeL?: number | null
    roofLoadKg?: number | null
    towingCapacityKg?: number | null
    maxSlopePct?: number | null
    accelerationS?: number | null
    topSpeedKmh?: number | null
    noiseDb?: number | null
}

interface SpecRow {
    label: string
    value: string
    mono?: boolean
}

// Enum members whose human form the generic title-case fallback can't
// produce (hyphens, brand-style capitals, domain terms).
const ENUM_LABELS: Record<string, string> = {
    DIESEL_MILD_HYBRID: 'Diesel mild hybrid',
    GASOLINE_MILD_HYBRID: 'Gasoline mild hybrid',
    FULL_HYBRID: 'Full hybrid',
    PLUG_IN_HYBRID: 'Plug-in hybrid',
    NATURAL_GAS: 'Natural gas',
    LIQUID_GAS: 'Liquid gas',
    BIO_ETHANOL: 'Bio-ethanol',
    PETROL_NORMAL: 'Petrol Normal',
    PETROL_SUPER: 'Petrol Super',
    PETROL_SUPER_PLUS: 'Petrol Super Plus',
    ROBOTIZED_MANUAL: 'Robotized manual',
    DUAL_CLUTCH: 'Dual-clutch',
    CVT: 'CVT',
    TORSION_BAR: 'Torsion bar',
    LEAF_SPRING: 'Leaf spring',
    HYDRO: 'Hydropneumatic',
}

const DRIVETRAIN_LABELS: Record<string, string> = {
    FRONT: 'Front-wheel drive',
    REAR: 'Rear-wheel drive',
    ALL: 'All-wheel drive',
}

const humanize = (value: string): string => {
    const known = ENUM_LABELS[value]
    if (known) return known
    const words = value.split('_').join(' ').toLowerCase()
    return words.charAt(0).toUpperCase() + words.slice(1)
}

const has = (v: unknown): boolean => v !== null && v !== undefined && v !== ''

const int = (v: number): string => Math.round(Number(v)).toLocaleString('en-US')

const dec = (v: number): string => Number(v).toFixed(1)

// tc-variant-spec-sheet — the full technical datasheet of one `model_variant`
// catalog row. Header (name, muted version, mono slug, production years), a
// signature 1px-gap hero strip of big mono dashboard readouts (power, 0–100,
// top speed, CO₂), then grouped key-value sections with dotted leader lines:
// Powertrain, Chassis, Dimensions, Consumption & Emissions. The `variant`
// object is a JS property (arrays/objects can't ride on attributes); every
// absent value skips its row, and a section with zero rows disappears
// entirely. `dense` tightens paddings for comparison layouts.
export class VariantSpecSheet extends HTMLElement {
    private _initialised = false
    private _variant: VariantSpec = {}

    static get observedAttributes(): string[] {
        return ['name', 'version', 'slug', 'years-text', 'dense']
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

    // ── Props ────────────────────────────────────────────────────────────────

    get variant(): VariantSpec {
        return this._variant
    }
    set variant(v: VariantSpec) {
        this._variant = v && typeof v === 'object' ? v : {}
        if (this._initialised) this.render()
    }

    get dense(): boolean {
        return this.hasAttribute('dense')
    }
    set dense(v: boolean) {
        if (v) this.setAttribute('dense', '')
        else this.removeAttribute('dense')
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    private _headerHtml(): string {
        const name = this.getAttribute('name')
        const version = this.getAttribute('version')
        const slug = this.getAttribute('slug')
        const yearsText = this.getAttribute('years-text')
        if (!name && !version && !slug && !yearsText) return ''
        const headingHtml =
            name || version
                ? `<div class="tc-variant-spec-sheet-heading">` +
                  (name ? `<span class="tc-variant-spec-sheet-name">${esc(name)}</span>` : '') +
                  (version
                      ? `<span class="tc-variant-spec-sheet-version">${esc(version)}</span>`
                      : '') +
                  `</div>`
                : ''
        const metaHtml =
            slug || yearsText
                ? `<div class="tc-variant-spec-sheet-meta">` +
                  (slug ? `<span class="tc-variant-spec-sheet-slug">${esc(slug)}</span>` : '') +
                  (yearsText
                      ? `<span class="tc-variant-spec-sheet-years">${esc(yearsText)}</span>`
                      : '') +
                  `</div>`
                : ''
        return `<header class="tc-variant-spec-sheet-header">${headingHtml}${metaHtml}</header>`
    }

    private _statHtml(label: string, value: string, unit: string, sub?: string): string {
        return (
            `<div class="tc-variant-spec-sheet-stat">` +
            `<span class="tc-variant-spec-sheet-stat-label">${esc(label)}</span>` +
            `<span class="tc-variant-spec-sheet-stat-value">${esc(value)}` +
            `<span class="tc-variant-spec-sheet-stat-unit">${esc(unit)}</span></span>` +
            (sub ? `<span class="tc-variant-spec-sheet-stat-sub">${esc(sub)}</span>` : '') +
            `</div>`
        )
    }

    private _heroHtml(): string {
        const v = this._variant
        const stats: string[] = []
        if (has(v.powerPs)) {
            stats.push(
                this._statHtml(
                    'Power',
                    int(v.powerPs as number),
                    'PS',
                    has(v.powerKw) ? `${int(v.powerKw as number)} kW` : undefined,
                ),
            )
        } else if (has(v.powerKw)) {
            stats.push(this._statHtml('Power', int(v.powerKw as number), 'kW'))
        }
        if (has(v.accelerationS)) {
            stats.push(this._statHtml('0–100 km/h', dec(v.accelerationS as number), 's'))
        }
        if (has(v.topSpeedKmh)) {
            stats.push(this._statHtml('Top speed', int(v.topSpeedKmh as number), 'km/h'))
        }
        if (has(v.co2GKm)) {
            stats.push(this._statHtml('CO₂', int(v.co2GKm as number), 'g/km'))
        }
        if (stats.length === 0) return ''
        return `<div class="tc-variant-spec-sheet-hero">${stats.join('')}</div>`
    }

    private _sectionHtml(title: string, rows: SpecRow[]): string {
        if (rows.length === 0) return ''
        const rowsHtml = rows
            .map(
                (row) =>
                    `<div class="tc-variant-spec-sheet-row">` +
                    `<span class="tc-variant-spec-sheet-row-label">${esc(row.label)}</span>` +
                    `<span class="tc-variant-spec-sheet-row-leader" aria-hidden="true"></span>` +
                    `<span class="tc-variant-spec-sheet-row-value${row.mono ? ' tc-variant-spec-sheet-row-value--mono' : ''}">${esc(row.value)}</span>` +
                    `</div>`,
            )
            .join('')
        return (
            `<section class="tc-variant-spec-sheet-section">` +
            `<h4 class="tc-variant-spec-sheet-section-title">${esc(title)}</h4>` +
            rowsHtml +
            `</section>`
        )
    }

    private _powertrainRows(): SpecRow[] {
        const v = this._variant
        const rows: SpecRow[] = []
        if (has(v.powertrain))
            rows.push({ label: 'Powertrain', value: humanize(v.powertrain as string) })
        if (has(v.fuelType)) rows.push({ label: 'Fuel', value: humanize(v.fuelType as string) })
        if (has(v.gearboxType)) {
            const gearsSuffix = has(v.gears) ? ` · ${v.gears}` : ''
            rows.push({ label: 'Gearbox', value: humanize(v.gearboxType as string) + gearsSuffix })
        } else if (has(v.gears)) {
            rows.push({ label: 'Gearbox', value: `${v.gears} gears` })
        }
        if (has(v.drivetrainType)) {
            rows.push({
                label: 'Drivetrain',
                value:
                    DRIVETRAIN_LABELS[v.drivetrainType as string] ??
                    humanize(v.drivetrainType as string),
            })
        }
        return rows
    }

    private _chassisRows(): SpecRow[] {
        const v = this._variant
        const rows: SpecRow[] = []
        if (has(v.frontSuspension))
            rows.push({ label: 'Front suspension', value: humanize(v.frontSuspension as string) })
        if (has(v.rearSuspension))
            rows.push({ label: 'Rear suspension', value: humanize(v.rearSuspension as string) })
        if (has(v.frontBrakes))
            rows.push({ label: 'Front brakes', value: humanize(v.frontBrakes as string) })
        if (has(v.rearBrakes))
            rows.push({ label: 'Rear brakes', value: humanize(v.rearBrakes as string) })
        if (has(v.frontTyre))
            rows.push({ label: 'Front tyres', value: v.frontTyre as string, mono: true })
        if (has(v.rearTyre))
            rows.push({ label: 'Rear tyres', value: v.rearTyre as string, mono: true })
        return rows
    }

    private _dimensionRows(): SpecRow[] {
        const v = this._variant
        const rows: SpecRow[] = []
        if (has(v.seats)) rows.push({ label: 'Seats', value: String(v.seats) })
        if (has(v.doors)) rows.push({ label: 'Doors', value: String(v.doors) })
        if (has(v.lengthMm))
            rows.push({ label: 'Length', value: `${int(v.lengthMm as number)} mm` })
        if (has(v.widthMm)) rows.push({ label: 'Width', value: `${int(v.widthMm as number)} mm` })
        if (has(v.heightMm))
            rows.push({ label: 'Height', value: `${int(v.heightMm as number)} mm` })
        if (has(v.wheelbaseMm))
            rows.push({ label: 'Wheelbase', value: `${int(v.wheelbaseMm as number)} mm` })
        // turning_circle_dm is stored in decimetres — render as metres.
        if (has(v.turningCircleDm))
            rows.push({
                label: 'Turning circle',
                value: `${dec((v.turningCircleDm as number) / 10)} m`,
            })
        if (has(v.trunkVolumeL))
            rows.push({ label: 'Trunk volume', value: `${int(v.trunkVolumeL as number)} l` })
        if (has(v.roofLoadKg))
            rows.push({ label: 'Roof load', value: `${int(v.roofLoadKg as number)} kg` })
        if (has(v.towingCapacityKg))
            rows.push({
                label: 'Towing capacity',
                value: `${int(v.towingCapacityKg as number)} kg`,
            })
        if (has(v.maxSlopePct))
            rows.push({ label: 'Max slope', value: `${int(v.maxSlopePct as number)}%` })
        return rows
    }

    private _consumptionRows(): SpecRow[] {
        const v = this._variant
        const rows: SpecRow[] = []
        if (has(v.consumptionL100km))
            rows.push({ label: 'Combined', value: `${dec(v.consumptionL100km as number)} l/100km` })
        if (has(v.consumptionCityL100km))
            rows.push({ label: 'City', value: `${dec(v.consumptionCityL100km as number)} l/100km` })
        if (has(v.consumptionHwyL100km))
            rows.push({
                label: 'Highway',
                value: `${dec(v.consumptionHwyL100km as number)} l/100km`,
            })
        if (has(v.fuelCapacityL))
            rows.push({ label: 'Fuel tank', value: `${dec(v.fuelCapacityL as number)} l` })
        if (has(v.adblueCapacityL))
            rows.push({ label: 'AdBlue tank', value: `${dec(v.adblueCapacityL as number)} l` })
        // NA is the emission_standard enum's explicit "not applicable" — skip it.
        if (has(v.emissionStandard) && v.emissionStandard !== 'NA')
            rows.push({
                label: 'Emission standard',
                value: v.emissionStandard as string,
                mono: true,
            })
        if (has(v.emissionCategory))
            rows.push({ label: 'Emission category', value: v.emissionCategory as string })
        if (has(v.noiseDb))
            rows.push({ label: 'Noise level', value: `${int(v.noiseDb as number)} dB` })
        return rows
    }

    private render(): void {
        const sectionsHtml =
            this._sectionHtml('Powertrain', this._powertrainRows()) +
            this._sectionHtml('Chassis', this._chassisRows()) +
            this._sectionHtml('Dimensions', this._dimensionRows()) +
            this._sectionHtml('Consumption & Emissions', this._consumptionRows())
        patchHtml(
            this,
            `<article class="tc-variant-spec-sheet${this.dense ? ' tc-variant-spec-sheet--dense' : ''}">` +
                this._headerHtml() +
                this._heroHtml() +
                (sectionsHtml
                    ? `<div class="tc-variant-spec-sheet-body">${sectionsHtml}</div>`
                    : '') +
                `</article>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VariantSpecSheet
    }
}
