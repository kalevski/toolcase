import { esc } from './internal/esc'

const TAG_NAME = 'tc-tyre-spec'

// tc-tyre-spec — a tyre sidewall readout for the vehicle-catalog `tyre_size`
// table. Parses ISO metric spec strings ("225/45 R17", "225/45R17", optional
// load/speed suffix "91V") into width / aspect / rim segments rendered as
// large mono digits with micro unit sub-labels, separated by hairlines — the
// sidewall marking re-set as an instrument readout. A spec that doesn't parse
// renders as the raw mono string (never crashes; commercial sizes like
// "185 R14C" stay legible).
//
// Two modes: `spec` renders a single axle row; `front-spec` + `rear-spec`
// render two rows with mono FRONT / REAR axle tags. When front ≠ rear a
// "STAGGERED" corner tag appears — the fitment fact worth surfacing.

interface ParsedSpec {
    width: string
    aspect: string
    rim: string
    loadSpeed: string | null
}

// "225/45 R17 91V" | "225/45R17" → segments; anything else → null.
function parseSpec(raw: string): ParsedSpec | null {
    const m = raw.trim().match(/^(\d{3})\s*\/\s*(\d{2,3})\s*R\s*(\d{2})(?:\s*(\d{2,3}\s?[A-Z]))?$/i)
    if (!m) return null
    return {
        width: m[1],
        aspect: m[2],
        rim: `R${m[3]}`,
        loadSpeed: m[4] ? m[4].replace(/\s+/g, '').toUpperCase() : null,
    }
}

export class TyreSpec extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['spec', 'front-spec', 'rear-spec']
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

    private _segmentHtml(value: string, subLabel: string): string {
        return (
            `<span class="tc-tyre-spec-segment">` +
            `<span class="tc-tyre-spec-value">${esc(value)}</span>` +
            `<span class="tc-tyre-spec-sub">${esc(subLabel)}</span>` +
            `</span>`
        )
    }

    private _readoutHtml(raw: string): string {
        const parsed = parseSpec(raw)
        if (!parsed) {
            return `<span class="tc-tyre-spec-raw">${esc(raw)}</span>`
        }
        return (
            `<span class="tc-tyre-spec-readout">` +
            this._segmentHtml(parsed.width, 'Width mm') +
            this._segmentHtml(parsed.aspect, 'Aspect %') +
            this._segmentHtml(parsed.rim, 'Rim in') +
            (parsed.loadSpeed ? this._segmentHtml(parsed.loadSpeed, 'Load spd') : '') +
            `</span>`
        )
    }

    private _rowHtml(raw: string, axle: string | null): string {
        return (
            `<div class="tc-tyre-spec-row">` +
            (axle ? `<span class="tc-tyre-spec-axle">${esc(axle)}</span>` : '') +
            this._readoutHtml(raw) +
            `</div>`
        )
    }

    private render(): void {
        const spec = this.getAttribute('spec')
        const front = this.getAttribute('front-spec')
        const rear = this.getAttribute('rear-spec')

        let rowsHtml = ''
        let staggered = false
        if (front || rear) {
            if (front) rowsHtml += this._rowHtml(front, 'Front')
            if (rear) rowsHtml += this._rowHtml(rear, 'Rear')
            staggered = !!front && !!rear && front.trim() !== rear.trim()
        } else if (spec) {
            rowsHtml = this._rowHtml(spec, null)
        }

        this.innerHTML =
            `<div class="tc-tyre-spec${staggered ? ' tc-tyre-spec--staggered' : ''}">` +
            (staggered ? `<span class="tc-tyre-spec-flag">Staggered</span>` : '') +
            rowsHtml +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TyreSpec
    }
}
