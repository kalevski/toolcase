const TAG_NAME = 'tc-level-header'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class LevelHeader extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['level', 'title', 'xp', 'xp-max', 'next-label']
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

    private _numAttr(name: string, fallback: number): number {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    get level(): number { return this._numAttr('level', 1) }
    set level(v: number) { this.setAttribute('level', String(v)) }

    // title is a native HTMLElement property — use getAttribute in render(), no getter/setter override.

    get xp(): number { return this._numAttr('xp', 0) }
    set xp(v: number) { this.setAttribute('xp', String(v)) }

    get xpMax(): number { return Math.max(1, this._numAttr('xp-max', 100)) }
    set xpMax(v: number) { this.setAttribute('xp-max', String(v)) }

    get nextLabel(): string { return this.getAttribute('next-label') ?? '' }
    set nextLabel(v: string) {
        if (v) this.setAttribute('next-label', v)
        else this.removeAttribute('next-label')
    }

    private render(): void {
        const level = this.level
        const titleText = this.getAttribute('title') ?? ''
        const xp = this.xp
        const xpMax = this.xpMax
        const nextLabel = this.nextLabel

        const pct = Math.max(0, Math.min(100, (xp / xpMax) * 100))

        this.classList.add('tc-level-header')
        this.setAttribute('role', 'region')
        this.setAttribute('aria-label', titleText ? `${esc(titleText)} — Level ${level}` : `Level ${level}`)

        const titleHtml = titleText
            ? `<span class="tc-level-header__title">${esc(titleText)}</span>`
            : ''

        const nextHtml = nextLabel
            ? `<span class="tc-level-header__next">Next: ${esc(nextLabel)}</span>`
            : ''

        this.innerHTML = `
            <div class="tc-level-header__badge" aria-hidden="true">
                <span class="tc-level-header__badge-label">LVL</span>
                <span class="tc-level-header__badge-value">${level}</span>
            </div>
            <div class="tc-level-header__body">
                ${titleHtml}
                <div class="tc-level-header__track"
                     role="progressbar"
                     aria-valuenow="${Math.round(xp)}"
                     aria-valuemin="0"
                     aria-valuemax="${Math.round(xpMax)}"
                     aria-label="XP">
                    <div class="tc-level-header__fill" style="width:${pct.toFixed(2)}%"></div>
                </div>
                <div class="tc-level-header__meta">
                    <span class="tc-level-header__xp">${Math.round(xp).toLocaleString()} / ${Math.round(xpMax).toLocaleString()} XP</span>
                    ${nextHtml}
                </div>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap { [TAG_NAME]: LevelHeader }
}
