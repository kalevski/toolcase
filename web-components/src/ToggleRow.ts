import { bindOnce } from './internal/patch-html'
import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'tc-toggle-row'

// tc-toggle-row — a generic labeled boolean toggle setting row. A label/
// description text block on the left paired with a pill-track switch
// (role="switch", pure-circle knob — the checked track carries the signature
// slate-ink gradient). Built on the shared SettingRowBase scaffold; subclasses
// such as tc-fullscreen-toggle extend this for preset-named rows. Port of
// game-components `gc-toggle-row` with the fantasy chrome dropped for the
// toolcase slate/ink look. All cosmetics flow through `--bs-toggle-row-*`.
export class ToggleRow extends SettingRowBase {
    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'checked', 'disabled']
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch checked/disabled in place — a full re-render would drop the
        // button's focus on every toggle.
        if (name === 'checked') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-toggle-row__switch')
            const checked = this.checked
            if (btn) {
                btn.setAttribute('aria-checked', String(checked))
                btn.dataset.checked = String(checked)
            }
            return
        }
        if (name === 'disabled') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-toggle-row__switch')
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
                class="tc-toggle-row__switch"
                role="switch"
                aria-checked="${checked}"
                data-checked="${checked}"
                aria-label="${this.escape(this.rowLabel)}"${disabledAttr}
            >
                <span class="tc-toggle-row__knob"></span>
            </button>
        `
    }

    protected bindControl(): void {
        const btn = this.querySelector<HTMLButtonElement>('.tc-toggle-row__switch')
        if (!btn) return
        // bindOnce — not addEventListener — because a row-label/description
        // attribute change re-runs renderRow(), and patchHtml REUSES this same
        // `.tc-toggle-row__switch` button across those renders (same tag at
        // the same position). A raw addEventListener here would stack a new
        // listener on every renderRow() call, so a single click would toggle
        // `checked` back and forth once per accumulated listener (net no-op)
        // while firing tc-change/onChange that many times.
        bindOnce(btn, 'click', () => {
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
        [TAG_NAME]: ToggleRow
    }
}
