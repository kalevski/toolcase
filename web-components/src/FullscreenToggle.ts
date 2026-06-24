import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'tc-fullscreen-toggle'

// tc-fullscreen-toggle — a fullscreen on/off preset row. A pill-track switch
// (role="switch") paired with the shared setting-row scaffold. Port of
// game-components `gc-fullscreen-toggle` (which extends `gc-toggle-row`) with the
// fantasy chrome dropped for the toolcase slate/ink look; the checked track
// carries the signature ink gradient. All cosmetics flow through
// `--bs-fullscreen-toggle-*`.
export class FullscreenToggle extends SettingRowBase {
    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'checked', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Fullscreen')
        super.connectedCallback()
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch checked/disabled on the embedded tc-switch in place — a full
        // re-render would drop the control's focus on every toggle.
        if (name === 'checked') {
            const sw = this.querySelector<HTMLElement>('tc-switch')
            if (sw) (sw as any).checked = this.checked
            return
        }
        if (name === 'disabled') {
            const sw = this.querySelector<HTMLElement>('tc-switch')
            if (sw) (sw as any).disabled = this.disabled
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
        const checkedAttr = this.checked ? ' checked' : ''
        const disabledAttr = this.disabled ? ' disabled' : ''
        // The control is a plain tc-switch (no label — the setting-row scaffold
        // supplies label + description). Cosmetics live in _switch.scss.
        return `<tc-switch class="tc-fullscreen-toggle__switch"${checkedAttr}${disabledAttr}></tc-switch>`
    }

    protected bindControl(): void {
        const sw = this.querySelector<HTMLElement>('tc-switch')
        if (!sw) return
        sw.addEventListener('tc-change', (e: Event) => {
            const next = (e as CustomEvent<{ value: boolean }>).detail?.value ?? !this.checked
            this.checked = next
            this.emit('tc-change', { value: next })
            if (typeof this.onChange === 'function') this.onChange(next)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FullscreenToggle
    }
}
