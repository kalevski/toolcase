const TAG_NAME = 'gc-player-frame'

export class PlayerFrame extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['name', 'class-name', 'glyph', 'level', 'hp', 'hp-max', 'mp', 'mp-max', 'stamina', 'stamina-max', 'show-mp', 'show-stamina']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        if (v) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get className(): string {
        return this.getAttribute('class-name') ?? ''
    }
    set className(v: string) {
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

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const level = this.level
        const portraitAttrs = [
            this.glyph ? `glyph="${this.escape(this.glyph)}"` : '',
            `size="56"`,
            level != null ? `level="${level}"` : '',
        ].filter(Boolean).join(' ')

        const classMarkup = this.className
            ? `<div class="gc-player-frame-class">${this.escape(this.className)}</div>`
            : ''

        const mpBar = this.showMp
            ? `<gc-mana-bar value="${this.mp}" max="${this.mpMax}" class="gc-player-frame-bar"></gc-mana-bar>`
            : ''
        const staminaBar = this.showStamina
            ? `<gc-stamina-bar value="${this.stamina}" max="${this.staminaMax}" class="gc-player-frame-bar"></gc-stamina-bar>`
            : ''

        this.innerHTML = `
            <div class="gc-player-frame-root">
                <div class="gc-player-frame-portrait">
                    <gc-portrait ${portraitAttrs}></gc-portrait>
                </div>
                <div class="gc-player-frame-body">
                    <div class="gc-player-frame-header">
                        <span class="gc-player-frame-name">${this.escape(this.name)}</span>
                        ${classMarkup}
                    </div>
                    <gc-health-bar value="${this.hp}" max="${this.hpMax}" class="gc-player-frame-bar"></gc-health-bar>
                    ${mpBar}
                    ${staminaBar}
                </div>
            </div>
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, PlayerFrame)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PlayerFrame
    }
}
