const TAG_NAME = 'gc-ammo-counter'

export class AmmoCounter extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['mag', 'mag-max', 'reserve', 'weapon-name', 'reloading']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get mag(): number {
        const raw = this.getAttribute('mag')
        if (raw == null) return 0
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set mag(v: number) {
        this.setAttribute('mag', String(v))
    }

    get magMax(): number {
        const raw = this.getAttribute('mag-max')
        if (raw == null) return 30
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) || parsed <= 0 ? 30 : parsed
    }
    set magMax(v: number) {
        this.setAttribute('mag-max', String(v))
    }

    get reserve(): number {
        const raw = this.getAttribute('reserve')
        if (raw == null) return 0
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set reserve(v: number) {
        this.setAttribute('reserve', String(v))
    }

    get weaponName(): string {
        return this.getAttribute('weapon-name') ?? ''
    }
    set weaponName(v: string) {
        this.setAttribute('weapon-name', v)
    }

    get reloading(): boolean {
        return this.hasAttribute('reloading')
    }
    set reloading(v: boolean) {
        if (v) this.setAttribute('reloading', '')
        else this.removeAttribute('reloading')
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
        const mag = this.mag
        const magMax = this.magMax
        const reserve = this.reserve
        const weaponName = this.weaponName
        const reloading = this.reloading
        const isLow = mag < magMax * 0.2

        this.dataset.state = reloading ? 'reloading' : (isLow ? 'low' : 'normal')

        const weaponRow = weaponName
            ? `<div class="gc-ammo-counter-weapon">${this.escape(weaponName)}</div>`
            : ''

        const stateLabel = reloading ? 'Reloading…' : ''
        const stateRow = stateLabel
            ? `<div class="gc-ammo-counter-state">${stateLabel}</div>`
            : ''

        this.innerHTML = `
            ${weaponRow}
            <div class="gc-ammo-counter-row">
                <span class="gc-ammo-counter-mag">${mag}</span>
                <span class="gc-ammo-counter-sep">/</span>
                <span class="gc-ammo-counter-max">${magMax}</span>
                <span class="gc-ammo-counter-reserve">+${reserve}</span>
            </div>
            ${stateRow}
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AmmoCounter
    }
}
