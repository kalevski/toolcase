import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'gc-toggle-row'

export class ToggleRow extends SettingRowBase {

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'checked']
    }

    get checked(): boolean {
        return this.hasAttribute('checked')
    }
    set checked(v: boolean) {
        if (v) this.setAttribute('checked', '')
        else this.removeAttribute('checked')
    }

    protected renderControl(): string {
        const checked = this.checked
        return `
            <button type="button" class="gc-setting-row-toggle" role="switch" aria-checked="${checked}" data-checked="${checked}">
                <span class="gc-setting-row-toggle-knob"></span>
            </button>
        `
    }

    protected bindControl(): void {
        const btn = this.querySelector('.gc-setting-row-toggle') as HTMLButtonElement | null
        if (!btn) return
        btn.addEventListener('click', () => {
            const next = !this.checked
            this.checked = next
            btn.dataset.checked = String(next)
            btn.setAttribute('aria-checked', String(next))
            this.emit('change', { value: next })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ToggleRow
    }
}
