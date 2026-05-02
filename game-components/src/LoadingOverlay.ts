const TAG_NAME = 'gc-loading-overlay'

export class LoadingOverlay extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['open', 'progress', 'label', 'tip']
    }

    constructor() {
        super()
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
    set open(value: boolean) {
        if (value) this.setAttribute('open', '')
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

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const progress = this.progress
        const indeterminate = progress == null
        const pct = indeterminate ? 0 : Math.max(0, Math.min(1, progress)) * 100
        const pctLabel = indeterminate ? '' : `${Math.round(pct)}%`
        const label = this.label
        const tip = this.tip

        const labelRow = label || !indeterminate
            ? `<div class="gc-loading-overlay-label-row"><span class="gc-loading-overlay-label">${this.escape(label)}</span><span class="gc-loading-overlay-pct">${pctLabel}</span></div>`
            : ''

        const barCls = `gc-loading-overlay-bar${indeterminate ? ' is-indeterminate' : ''}`
        const fillStyle = indeterminate ? '' : `style="width: ${pct.toFixed(2)}%"`

        const tipMarkup = tip
            ? `<div class="gc-loading-overlay-tip">${this.escape(tip)}</div>`
            : ''

        this.innerHTML = `
            <div class="gc-loading-overlay-backdrop"></div>
            <div class="gc-loading-overlay-panel" role="document">
                <div class="gc-loading-overlay-spinner" aria-hidden="true">
                    <span class="gc-loading-overlay-spinner-rune">✦</span>
                </div>
                ${labelRow}
                <div class="${barCls}">
                    <div class="gc-loading-overlay-bar-fill" ${fillStyle}></div>
                    <div class="gc-loading-overlay-bar-scanlines"></div>
                </div>
                ${tipMarkup}
            </div>
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, LoadingOverlay)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LoadingOverlay
    }
}
