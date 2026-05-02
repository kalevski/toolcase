import { html, type TemplateResult } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { SettingRowBase } from './_setting-row-base.js'
import { styles } from '../styles/ResetToDefaults.styles.js'

@customElement('gc-reset-to-defaults')
export class ResetToDefaults extends SettingRowBase {
    static styles = styles

    @state() private _confirming = false

    constructor() { super(); this.rowLabel = 'Reset to defaults' }

    protected renderControl(): TemplateResult {
        if (this._confirming) {
            return html`<div class="row">
                <button class="confirm" @click=${() => { this._confirming = false; this.emit('reset') }}>Confirm</button>
                <button class="cancel" @click=${() => { this._confirming = false }}>Cancel</button>
            </div>`
        }
        return html`<button class="reset" @click=${() => { this._confirming = true }}>Reset</button>`
    }
}
