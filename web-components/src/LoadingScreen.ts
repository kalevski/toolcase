import { esc } from './internal/esc'
const TAG_NAME = 'tc-loading-screen'

/**
 * tc-loading-screen — full-viewport loading screen with an eyebrow label,
 * optional title, progress bar (determinate or indeterminate), and an optional
 * cycling tip section. Ported from gc-loading-screen (game-components) but
 * voiced for the web-components design system: slate surface, sharp panel, no
 * game chrome. The component is always visible when present in the DOM;
 * add/remove it (or toggle [hidden]) to show/hide the loading state.
 *
 * No slots — purely attribute- and JS-property-driven.
 */
export class LoadingScreen extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['progress', 'label', 'eyebrow', 'title-text', 'tip-title', 'tip-interval']
    }

    private _tips: string[] = []
    private _tipIndex = 0
    private _intervalId: ReturnType<typeof setInterval> | null = null
    private _visibilityHandler: (() => void) | null = null

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'status')
        this.setAttribute('aria-live', 'polite')
        this.render()
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected) return
        if (name === 'tip-interval') {
            this._detachHandlers()
            this._attachHandlers()
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
        this._tipIndex = 0
        if (this.isConnected) {
            this.render()
            this._detachHandlers()
            this._attachHandlers()
        }
    }

    private _clearInterval(): void {
        if (this._intervalId != null) {
            clearInterval(this._intervalId)
            this._intervalId = null
        }
    }

    private _startInterval(): void {
        if (this._tips.length < 2) return
        this._intervalId = setInterval(() => {
            this._tipIndex = (this._tipIndex + 1) % this._tips.length
            this._patchTip()
        }, this.tipInterval)
    }

    private _attachHandlers(): void {
        this._detachHandlers()
        this._visibilityHandler = () => {
            if (document.hidden) {
                this._clearInterval()
            } else {
                this._startInterval()
            }
        }
        document.addEventListener('visibilitychange', this._visibilityHandler)
        if (!document.hidden) {
            this._startInterval()
        }
    }

    private _detachHandlers(): void {
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler)
            this._visibilityHandler = null
        }
        this._clearInterval()
    }

    // Surgical tip-body update — avoids a full re-render on interval tick.
    private _patchTip(): void {
        const el = this.querySelector<HTMLElement>('.tc-loading-screen-tip-body')
        if (!el) return
        el.textContent = this._tips[this._tipIndex] ?? ''
    }

    private render(): void {
        const eyebrow = this.eyebrow
        const title = this.titleText
        const label = this.label
        const progress = this.progress
        const indeterminate = progress == null
        const pct = indeterminate ? 0 : Math.max(0, Math.min(1, progress)) * 100
        const pctLabel = indeterminate ? '' : `${Math.round(pct)}%`

        const titleMarkup = title ? `<div class="tc-loading-screen-title">${esc(title)}</div>` : ''

        const showLabelRow = !!label || !indeterminate
        const labelRow = showLabelRow
            ? `<div class="tc-loading-screen-label-row">
                <span class="tc-loading-screen-label">${esc(label)}</span>
                <span class="tc-loading-screen-pct">${esc(pctLabel)}</span>
               </div>`
            : ''

        const barMod = indeterminate ? ' tc-loading-screen-bar--indeterminate' : ''
        const fillStyle = indeterminate ? '' : ` style="width:${pct.toFixed(2)}%"`
        const ariaValueNow = indeterminate ? '' : ` aria-valuenow="${Math.round(pct)}"`

        const tip = this._tips[this._tipIndex] ?? ''
        const tipMarkup =
            this._tips.length > 0
                ? `<div class="tc-loading-screen-tip">
                <div class="tc-loading-screen-tip-label">${esc(this.tipTitle)}</div>
                <div class="tc-loading-screen-tip-body">${esc(tip)}</div>
               </div>`
                : ''

        this.innerHTML = `
            <div class="tc-loading-screen-panel">
                <div class="tc-loading-screen-header">
                    <div class="tc-loading-screen-eyebrow">${esc(eyebrow)}</div>
                    ${titleMarkup}
                </div>
                ${labelRow}
                <div class="tc-loading-screen-bar${barMod}"
                     role="progressbar"${ariaValueNow}
                     aria-valuemin="0"
                     aria-valuemax="100"
                     aria-label="${esc(label || 'Loading')}">
                    <div class="tc-loading-screen-bar-fill"${fillStyle}></div>
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
