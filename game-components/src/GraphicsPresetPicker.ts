import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'gc-graphics-preset-picker'

const PRESETS: { value: string, label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'ultra', label: 'Ultra' },
]

export class GraphicsPresetPicker extends SettingRowBase {

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Quality preset')
        if (!this.hasAttribute('value')) this.setAttribute('value', 'medium')
        super.connectedCallback()
    }

    get value(): string {
        return this.getAttribute('value') ?? 'medium'
    }
    set value(v: string) {
        this.setAttribute('value', v)
    }

    protected renderControl(): string {
        const value = this.value
        const buttons = PRESETS.map(p => {
            const active = p.value === value ? 'data-active="true"' : ''
            return `<button type="button" class="gc-setting-row-preset" data-value="${p.value}" ${active}>${p.label}</button>`
        }).join('')
        return `<div class="gc-setting-row-preset-group">${buttons}</div>`
    }

    protected bindControl(): void {
        const buttons = this.querySelectorAll('.gc-setting-row-preset') as NodeListOf<HTMLButtonElement>
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const v = btn.dataset.value ?? 'medium'
                this.setAttribute('value', v)
                this.emit('change', { value: v })
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GraphicsPresetPicker
    }
}
