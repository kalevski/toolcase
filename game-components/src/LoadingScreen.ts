const TAG_NAME = 'gc-loading-screen'

export class LoadingScreen extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['progress', 'label', 'eyebrow', 'title-text', 'tip-title', 'tip-interval']
    }

    private _tips: string[] = []
    private tipIndex = 0
    private tipTimer: number | null = null

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'status')
        this.setAttribute('aria-live', 'polite')
        this.render()
        this.startTipCycle()
    }

    disconnectedCallback(): void {
        this.stopTipCycle()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected) return
        if (name === 'tip-interval') {
            this.startTipCycle()
            return
        }
        this.render()
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

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? 'Loading'
    }
    set eyebrow(v: string) {
        if (v) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get titleText(): string {
        return this.getAttribute('title-text') ?? ''
    }
    set titleText(v: string) {
        if (v) this.setAttribute('title-text', v)
        else this.removeAttribute('title-text')
    }

    get tipTitle(): string {
        return this.getAttribute('tip-title') ?? 'Tip'
    }
    set tipTitle(v: string) {
        if (v) this.setAttribute('tip-title', v)
        else this.removeAttribute('tip-title')
    }

    get tipInterval(): number {
        const raw = this.getAttribute('tip-interval')
        if (raw == null) return 5000
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000
    }
    set tipInterval(v: number) {
        this.setAttribute('tip-interval', String(v))
    }

    get tips(): string[] {
        return this._tips.slice()
    }
    set tips(v: string[]) {
        this._tips = Array.isArray(v) ? v.slice() : []
        this.tipIndex = 0
        if (this.isConnected) {
            this.render()
            this.startTipCycle()
        }
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private stopTipCycle(): void {
        if (this.tipTimer != null) {
            window.clearInterval(this.tipTimer)
            this.tipTimer = null
        }
    }

    private startTipCycle(): void {
        this.stopTipCycle()
        if (this._tips.length < 2) return
        this.tipTimer = window.setInterval(() => {
            this.tipIndex = (this.tipIndex + 1) % this._tips.length
            this.updateTip()
        }, this.tipInterval)
    }

    private updateTip(): void {
        const el = this.querySelector('.gc-loading-screen-tip-body') as HTMLElement | null
        if (!el) return
        const tip = this._tips[this.tipIndex] ?? ''
        el.textContent = tip
    }

    private render(): void {
        const eyebrow = this.eyebrow
        const title = this.titleText
        const label = this.label
        const progress = this.progress
        const indeterminate = progress == null
        const pct = indeterminate ? 0 : Math.max(0, Math.min(1, progress)) * 100
        const pctLabel = indeterminate ? '' : `${Math.round(pct)}%`

        const titleMarkup = title
            ? `<gc-title class="gc-loading-screen-title">${this.escape(title)}</gc-title>`
            : ''

        const labelRow = label || !indeterminate
            ? `<div class="gc-loading-screen-label-row">
                <span class="gc-loading-screen-label">${this.escape(label)}</span>
                <span class="gc-loading-screen-pct">${pctLabel}</span>
            </div>`
            : ''

        const barCls = `gc-loading-screen-bar${indeterminate ? ' is-indeterminate' : ''}`
        const fillStyle = indeterminate ? '' : `style="width: ${pct.toFixed(2)}%"`

        const tip = this._tips[this.tipIndex] ?? ''
        const tipMarkup = this._tips.length > 0
            ? `<div class="gc-loading-screen-tip">
                <gc-eyebrow class="gc-loading-screen-tip-eyebrow">${this.escape(this.tipTitle)}</gc-eyebrow>
                <div class="gc-loading-screen-tip-body">${this.escape(tip)}</div>
            </div>`
            : ''

        this.innerHTML = `
            <div class="gc-loading-screen-root">
                <div class="gc-loading-screen-header">
                    <gc-eyebrow class="gc-loading-screen-eyebrow">${this.escape(eyebrow)}</gc-eyebrow>
                    ${titleMarkup}
                </div>
                ${labelRow}
                <div class="${barCls}">
                    <div class="gc-loading-screen-bar-fill" ${fillStyle}></div>
                    <div class="gc-loading-screen-bar-scanlines"></div>
                </div>
                ${tipMarkup}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LoadingScreen
    }
}
