const TAG_NAME = 'tc-loading-overlay'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

/**
 * tc-loading-overlay — full-surface loading overlay with a spinner ring,
 * optional label, determinate or indeterminate progress bar, and an optional
 * tip line. Ported from `gc-loading-overlay` (game-components) but voiced for
 * the web-components design system: flat slate ink scrim, no game chrome,
 * Bootstrap-compatible progress conventions.
 *
 * Visibility is driven by the `[open]` boolean attribute via a CSS attribute
 * selector (`tc-loading-overlay:not([open]) { display: none }`). The consumer
 * sets `open` to show/hide; the component never self-closes.
 *
 * No slots — purely attribute-driven; `render()` writes innerHTML on every
 * attribute change and skips the slot-capture cycle.
 */
export class LoadingOverlay extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['open', 'progress', 'label', 'tip']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'status')
        this.setAttribute('aria-live', 'polite')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get progress(): number | null {
        const raw = this.getAttribute('progress')
        if (raw == null || raw === '') return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set progress(v: number | null) {
        if (v == null) this.removeAttribute('progress')
        else this.setAttribute('progress', String(v))
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        if (v) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get tip(): string {
        return this.getAttribute('tip') ?? ''
    }
    set tip(v: string) {
        if (v) this.setAttribute('tip', v)
        else this.removeAttribute('tip')
    }

    private render(): void {
        const progress = this.progress
        const label    = this.label
        const tip      = this.tip

        const indeterminate = progress == null
        const pct           = indeterminate ? 0 : Math.max(0, Math.min(1, progress)) * 100
        const pctLabel      = indeterminate ? '' : `${Math.round(pct)}%`

        // Label row: visible when there is a text label OR a determinate value
        const showLabelRow = !!label || !indeterminate
        const labelRow = showLabelRow
            ? `<div class="tc-loading-overlay-label-row">
                <span class="tc-loading-overlay-label">${esc(label)}</span>
                <span class="tc-loading-overlay-pct">${esc(pctLabel)}</span>
               </div>`
            : ''

        const barMod       = indeterminate ? ' tc-loading-overlay-bar--indeterminate' : ''
        const fillStyle    = indeterminate ? '' : ` style="width:${pct.toFixed(2)}%"`
        const ariaValueNow = indeterminate ? '' : ` aria-valuenow="${Math.round(pct)}"`

        const tipMarkup = tip
            ? `<div class="tc-loading-overlay-tip">${esc(tip)}</div>`
            : ''

        this.innerHTML = `
            <div class="tc-loading-overlay-backdrop" aria-hidden="true"></div>
            <div class="tc-loading-overlay-panel">
                <div class="tc-loading-overlay-spinner" aria-hidden="true">
                    <span class="spinner-border tc-loading-overlay-spinner-ring"></span>
                </div>
                ${labelRow}
                <div class="tc-loading-overlay-bar${barMod}"
                     role="progressbar"${ariaValueNow}
                     aria-valuemin="0"
                     aria-valuemax="100"
                     aria-label="${esc(label || 'Loading')}">
                    <div class="tc-loading-overlay-bar-fill"${fillStyle}></div>
                </div>
                ${tipMarkup}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap { [TAG_NAME]: LoadingOverlay }
}
