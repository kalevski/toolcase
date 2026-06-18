import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'tc-vsync-toggle'

// tc-vsync-toggle — a vsync on/off preset row. A pill-track switch
// (role="switch") paired with the shared setting-row scaffold. Port of
// game-components `gc-vsync-toggle` (which extends `gc-toggle-row`) with the
// fantasy chrome dropped for the toolcase slate/ink look; the checked track
// carries the signature ink gradient. All cosmetics flow through
// `--bs-vsync-toggle-*`.
export class VSyncToggle extends SettingRowBase {

    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'checked', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'V-Sync')
        super.connectedCallback()
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch checked/disabled in place — a full re-render would drop the
        // button's focus on every toggle.
        if (name === 'checked') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-vsync-toggle__switch')
            const checked = this.checked
            if (btn) {
                btn.setAttribute('aria-checked', String(checked))
                btn.dataset.checked = String(checked)
            }
            return
        }
        if (name === 'disabled') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-vsync-toggle__switch')
            if (btn) btn.disabled = this.disabled
            return
        }
        super.attributeChangedCallback(name, old, next)
    }

    get checked(): boolean {
        return this.hasAttribute('checked')
    }
    set checked(v: boolean) {
        if (v) this.setAttribute('checked', '')
        else this.removeAttribute('checked')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    protected renderControl(): string {
        const checked = this.checked
        const disabledAttr = this.disabled ? ' disabled' : ''
        return `
            <button
                type="button"
                class="tc-vsync-toggle__switch"
                role="switch"
                aria-checked="${checked}"
                data-checked="${checked}"
                aria-label="${this.escape(this.rowLabel)}"${disabledAttr}
            >
                <span class="tc-vsync-toggle__knob"></span>
            </button>
        `
    }

    protected bindControl(): void {
        const btn = this.querySelector<HTMLButtonElement>('.tc-vsync-toggle__switch')
        if (!btn) return
        btn.addEventListener('click', () => {
            if (this.disabled) return
            const next = !this.checked
            this.checked = next
            btn.dataset.checked = String(next)
            btn.setAttribute('aria-checked', String(next))
            this.emit('tc-change', { value: next })
            if (typeof this.onChange === 'function') this.onChange(next)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VSyncToggle
    }
}
