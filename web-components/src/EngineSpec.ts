import { esc } from './internal/esc'

const TAG_NAME = 'tc-engine-spec'

// tc-engine-spec — a machined engine ID plate, styled after the stamped data
// plate riveted to an engine block. Header row: the engine `code` as a mono
// stamped serial, muted `manufacturer`, and a derived CONFIG badge combining
// layout + cylinder count (V + 6 → "V6", BOXER + 4 → "B4", SERIES + 6 → "L6",
// ROTARY → "R", SINGLE → "1CYL"). Below, a hairline key-value cell grid (1px
// gaps showing the border color through) for the mechanical config: capacity,
// valvetrain, torque, peak rpm, injection, aspiration, emission control.
//
// Mirrors the `engine` table of the vehicle-catalog schema — every column an
// optional attribute; an absent attribute (SQL NULL) renders nothing, per the
// schema's "unknown is always NULL" rule. `compact` collapses the plate to the
// headline cells (displacement + torque) for listing-page use.

export type EngineLayout = 'BOXER' | 'SERIES' | 'V' | 'ROTARY' | 'SINGLE'

const LAYOUT_LABELS: Record<string, string> = {
    BOXER: 'Boxer',
    SERIES: 'Inline',
    V: 'V',
    ROTARY: 'Rotary',
    SINGLE: 'Single cylinder',
}

const POSITION_LABELS: Record<string, string> = {
    FRONT: 'Front',
    REAR: 'Rear',
    MID: 'Mid',
}

const EMISSION_CONTROL_LABELS: Record<string, string> = {
    DPF: 'DPF',
    DPF_OPEN: 'Open DPF',
    OTTO_PARTICULATE_FILTER: 'Otto particulate filter',
    EGR: 'EGR',
    NOX_STORAGE_CAT_WITH_DPF: 'NOx storage cat + DPF',
    SCR_CAT_WITH_DPF: 'SCR cat + DPF',
    SCR_AND_NOX_STORAGE_CAT_WITH_DPF: 'SCR + NOx storage cat + DPF',
    OXY_CAT: 'Oxy cat',
    REGULATED: 'Regulated',
    UNREGULATED: 'Unregulated',
}

const FUEL_INJECTION_LABELS: Record<string, string> = {
    CARBURETTOR: 'Carburettor',
    INJECTION: 'Injection',
    DIRECT_INJECTION: 'Direct injection',
    CENTRAL_DIRECT_INJECTION: 'Central direct injection',
    COMMON_RAIL: 'Common rail',
    PUMP_NOZZLE: 'Pump nozzle',
}

const SUPERCHARGER_LABELS: Record<string, string> = {
    TURBO: 'Turbo',
    BI_TURBO: 'Bi-turbo',
    TRI_TURBO: 'Tri-turbo',
    QUAD_TURBO: 'Quad-turbo',
    COMPRESSOR: 'Compressor',
    CENTRIFUGAL_COMPRESSOR: 'Centrifugal compressor',
    COMPREX: 'Comprex',
    TURBO_ELECTRICALLY_DRIVEN_COMPRESSOR: 'Turbo + e-compressor',
    BI_TURBO_ELECTRICALLY_DRIVEN_COMPRESSOR: 'Bi-turbo + e-compressor',
}

// Generic fallback so an unmapped enum member degrades to "Title case words"
// instead of raw SCREAMING_SNAKE.
function humanize(value: string): string {
    const words = value.toLowerCase().split('_').join(' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
}

function label(map: Record<string, string>, value: string): string {
    return map[value] ?? humanize(value)
}

// "2998" → "2,998"; non-numeric input passes through untouched.
function formatNumber(raw: string): string {
    const n = Number(raw)
    return Number.isFinite(n) ? n.toLocaleString('en-US') : raw
}

interface Cell {
    label: string
    value: string
    unit?: string
}

export class EngineSpec extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return [
            'code',
            'manufacturer',
            'layout',
            'position',
            'emission-control',
            'fuel-injection',
            'supercharger',
            'displacement-cc',
            'cylinders',
            'valves',
            'torque-nm',
            'power-at-rpm',
            'torque-at-rpm',
            'compact',
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

    get compact(): boolean {
        return this.hasAttribute('compact')
    }
    set compact(v: boolean) {
        if (v) this.setAttribute('compact', '')
        else this.removeAttribute('compact')
    }

    // ── Derivations ──────────────────────────────────────────────────────────

    // The stamped configuration shorthand: layout letter + cylinder count.
    private _configBadge(): string | null {
        const layout = this.getAttribute('layout')
        const cylinders = this.getAttribute('cylinders')
        switch (layout) {
            case 'V':
                return cylinders ? `V${cylinders}` : 'V'
            case 'BOXER':
                return cylinders ? `B${cylinders}` : 'B'
            case 'SERIES':
                return cylinders ? `L${cylinders}` : 'L'
            case 'ROTARY':
                return cylinders ? `R${cylinders}` : 'R'
            case 'SINGLE':
                return '1CYL'
            default:
                return cylinders ? `${cylinders}CYL` : null
        }
    }

    private _cells(): Cell[] {
        const attr = (name: string) => this.getAttribute(name)
        const cells: Cell[] = []
        const push = (raw: string | null, cellLabel: string, value: (raw: string) => string, unit?: string) => {
            if (raw != null && raw !== '') cells.push({ label: cellLabel, value: value(raw), unit })
        }

        push(attr('displacement-cc'), 'Displacement', formatNumber, 'cc')
        push(attr('torque-nm'), 'Torque', formatNumber, 'Nm')
        if (this.compact) return cells

        push(attr('cylinders'), 'Cylinders', (v) => v)
        push(attr('valves'), 'Valves', (v) => v)
        push(attr('power-at-rpm'), 'Power peak', formatNumber, 'rpm')
        push(attr('torque-at-rpm'), 'Torque peak', formatNumber, 'rpm')
        push(attr('layout'), 'Layout', (v) => label(LAYOUT_LABELS, v))
        push(attr('position'), 'Position', (v) => label(POSITION_LABELS, v))
        push(attr('fuel-injection'), 'Injection', (v) => label(FUEL_INJECTION_LABELS, v))
        push(attr('supercharger'), 'Aspiration', (v) => label(SUPERCHARGER_LABELS, v))
        push(attr('emission-control'), 'Emission control', (v) => label(EMISSION_CONTROL_LABELS, v))
        return cells
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    private render(): void {
        const code = this.getAttribute('code')
        const manufacturer = this.getAttribute('manufacturer')
        const config = this._configBadge()

        const headHtml =
            code || manufacturer || config
                ? `<header class="tc-engine-spec-head">` +
                  `<div class="tc-engine-spec-id">` +
                  (code ? `<span class="tc-engine-spec-code">${esc(code)}</span>` : '') +
                  (manufacturer ? `<span class="tc-engine-spec-manufacturer">${esc(manufacturer)}</span>` : '') +
                  `</div>` +
                  (config ? `<span class="tc-engine-spec-config">${esc(config)}</span>` : '') +
                  `</header>`
                : ''

        const cellsHtml = this._cells()
            .map(
                (cell) =>
                    `<div class="tc-engine-spec-cell">` +
                    `<span class="tc-engine-spec-cell-label">${esc(cell.label)}</span>` +
                    `<span class="tc-engine-spec-cell-value">${esc(cell.value)}` +
                    (cell.unit ? ` <span class="tc-engine-spec-cell-unit">${esc(cell.unit)}</span>` : '') +
                    `</span>` +
                    `</div>`,
            )
            .join('')

        this.innerHTML =
            `<div class="tc-engine-spec${this.compact ? ' tc-engine-spec--compact' : ''}">` +
            headHtml +
            (cellsHtml ? `<div class="tc-engine-spec-grid">${cellsHtml}</div>` : '') +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EngineSpec
    }
}
