import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'gc-reset-to-defaults'

export class ResetToDefaults extends SettingRowBase {

    private confirming = false

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Reset to defaults')
        super.connectedCallback()
    }

    protected renderControl(): string {
        const label = this.confirming ? 'Confirm reset' : 'Reset'
        const variant = this.confirming ? 'danger' : 'default'
        return `
            <div class="gc-setting-row-reset">
                <gc-metal-button class="gc-setting-row-reset-btn" data-variant="${variant}" variant="${variant}">${label}</gc-metal-button>
                ${this.confirming ? `<gc-metal-button class="gc-setting-row-reset-cancel" variant="ghost">Cancel</gc-metal-button>` : ''}
            </div>
        `
    }

    protected bindControl(): void {
        const btn = this.querySelector('.gc-setting-row-reset-btn') as HTMLElement | null
        const cancel = this.querySelector('.gc-setting-row-reset-cancel') as HTMLElement | null
        if (btn) {
            btn.addEventListener('click', () => {
                if (!this.confirming) {
                    this.confirming = true
                    this.renderRow()
                } else {
                    this.confirming = false
                    this.emit('reset')
                    this.renderRow()
                }
            })
        }
        if (cancel) {
            cancel.addEventListener('click', () => {
                this.confirming = false
                this.renderRow()
            })
        }
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ResetToDefaults)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ResetToDefaults
    }
}
