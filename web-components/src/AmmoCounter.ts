import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-ammo-counter'

export type AmmoCounterState = 'normal' | 'low' | 'reloading'

export class AmmoCounter extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['mag', 'mag-max', 'reserve', 'weapon-name', 'reloading']
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
        setAttr(this, 'weapon-name', v)
    }

    get reloading(): boolean {
        return this.hasAttribute('reloading')
    }
    set reloading(v: boolean) {
        if (v) this.setAttribute('reloading', '')
        else this.removeAttribute('reloading')
    }

    private render(): void {
        const mag = this.mag
        const magMax = this.magMax
        const reserve = this.reserve
        const weaponName = this.weaponName
        const reloading = this.reloading
        const isLow = mag < magMax * 0.2

        const state: AmmoCounterState = reloading ? 'reloading' : isLow ? 'low' : 'normal'

        // Component-owned host class via classList so author-supplied classes survive.
        this.classList.add('tc-ammo-counter')
        this.dataset.state = state

        const weaponRow = weaponName
            ? `<div class="tc-ammo-counter-weapon">${esc(weaponName)}</div>`
            : ''

        const stateRow = reloading
            ? `<div class="tc-ammo-counter-state" role="status">Reloading…</div>`
            : ''

        patchHtml(
            this,
            [
                weaponRow,
                '<div class="tc-ammo-counter-row">',
                `<span class="tc-ammo-counter-mag">${mag}</span>`,
                '<span class="tc-ammo-counter-sep" aria-hidden="true">/</span>',
                `<span class="tc-ammo-counter-max">${magMax}</span>`,
                `<span class="tc-ammo-counter-reserve">+${reserve}</span>`,
                '</div>',
                stateRow,
            ].join(''),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AmmoCounter
    }
}
