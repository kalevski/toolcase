import { patchHtml } from './internal/patch-html'
import { escapeHtml } from './internal/resourceBar'

const TAG_NAME = 'tc-player-frame'

function renderBar(
    kind: 'hp' | 'mp' | 'stamina',
    value: number,
    max: number,
    label: string,
): string {
    const safeMax = max > 0 ? max : 100
    const safeValue = Math.max(0, Math.min(safeMax, value))
    const pct = (safeValue / safeMax) * 100

    return (
        `<div class="tc-player-frame__bar" data-kind="${kind}"` +
        ` role="progressbar"` +
        ` aria-label="${escapeHtml(label)}"` +
        ` aria-valuenow="${Math.round(safeValue)}"` +
        ` aria-valuemin="0"` +
        ` aria-valuemax="${Math.round(safeMax)}">` +
        `<div class="tc-player-frame__bar-fill" style="width: ${pct.toFixed(2)}%"></div>` +
        `</div>`
    )
}

export class PlayerFrame extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return [
            'name',
            'class-name',
            'glyph',
            'level',
            'hp',
            'hp-max',
            'mp',
            'mp-max',
            'stamina',
            'stamina-max',
            'show-mp',
            'show-stamina',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // HTMLElement does not natively reflect a `.name` property on generic elements;
    // this getter is safe (unlike `title` or `role` which are ARIAMixin/HTMLElement builtins).
    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        if (v) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    // `classLabel` maps to the `class-name` attribute; renamed to avoid shadowing
    // the native `HTMLElement.className` property which reflects the `class` attribute.
    get classLabel(): string {
        return this.getAttribute('class-name') ?? ''
    }
    set classLabel(v: string) {
        if (v) this.setAttribute('class-name', v)
        else this.removeAttribute('class-name')
    }

    get glyph(): string {
        return this.getAttribute('glyph') ?? ''
    }
    set glyph(v: string) {
        if (v) this.setAttribute('glyph', v)
        else this.removeAttribute('glyph')
    }

    get level(): number | null {
        const raw = this.getAttribute('level')
        if (raw == null) return null
        const parsed = parseInt(raw, 10)
        return Number.isFinite(parsed) ? parsed : null
    }
    set level(v: number | null) {
        if (v == null) this.removeAttribute('level')
        else this.setAttribute('level', String(v))
    }

    get hp(): number {
        const raw = this.getAttribute('hp')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : 0
    }
    set hp(v: number) {
        this.setAttribute('hp', String(v))
    }

    get hpMax(): number {
        const raw = this.getAttribute('hp-max')
        if (raw == null) return 100
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
    }
    set hpMax(v: number) {
        this.setAttribute('hp-max', String(v))
    }

    get mp(): number {
        const raw = this.getAttribute('mp')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : 0
    }
    set mp(v: number) {
        this.setAttribute('mp', String(v))
    }

    get mpMax(): number {
        const raw = this.getAttribute('mp-max')
        if (raw == null) return 100
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
    }
    set mpMax(v: number) {
        this.setAttribute('mp-max', String(v))
    }

    get stamina(): number {
        const raw = this.getAttribute('stamina')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : 0
    }
    set stamina(v: number) {
        this.setAttribute('stamina', String(v))
    }

    get staminaMax(): number {
        const raw = this.getAttribute('stamina-max')
        if (raw == null) return 100
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 100
    }
    set staminaMax(v: number) {
        this.setAttribute('stamina-max', String(v))
    }

    get showMp(): boolean {
        return this.hasAttribute('show-mp')
    }
    set showMp(v: boolean) {
        if (v) this.setAttribute('show-mp', '')
        else this.removeAttribute('show-mp')
    }

    get showStamina(): boolean {
        return this.hasAttribute('show-stamina')
    }
    set showStamina(v: boolean) {
        if (v) this.setAttribute('show-stamina', '')
        else this.removeAttribute('show-stamina')
    }

    private render(): void {
        const level = this.level
        const glyph = this.glyph
        const classLabel = this.getAttribute('class-name') ?? ''

        // Portrait
        const glyphSpan = `<span class="tc-player-frame__glyph" aria-hidden="true">${glyph ? escapeHtml(glyph) : '&#x2014;'}</span>`
        const levelBadge =
            level != null
                ? `<span class="tc-player-frame__level" aria-hidden="true">${level}</span>`
                : ''

        // Header row (name + class label)
        const classSpan = classLabel
            ? `<span class="tc-player-frame__class">${escapeHtml(classLabel)}</span>`
            : ''

        // Bars
        const hpBar = renderBar('hp', this.hp, this.hpMax, 'Health')
        const mpBar = this.showMp ? renderBar('mp', this.mp, this.mpMax, 'Mana') : ''
        const staminaBar = this.showStamina
            ? renderBar('stamina', this.stamina, this.staminaMax, 'Stamina')
            : ''

        patchHtml(
            this,
            `
            <div class="tc-player-frame">
                <div class="tc-player-frame__portrait" aria-hidden="true">
                    ${glyphSpan}
                    ${levelBadge}
                </div>
                <div class="tc-player-frame__body">
                    <div class="tc-player-frame__header">
                        <span class="tc-player-frame__name">${escapeHtml(this.name)}</span>
                        ${classSpan}
                    </div>
                    <div class="tc-player-frame__bars">
                        ${hpBar}
                        ${mpBar}
                        ${staminaBar}
                    </div>
                </div>
            </div>
        `,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PlayerFrame
    }
}
