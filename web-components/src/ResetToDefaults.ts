import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'tc-reset-to-defaults'

// tc-reset-to-defaults — a two-step reset action on the shared setting-row scaffold.
// Clicking "Reset" enters a confirmation state; "Confirm reset" fires tc-reset
// and returns to the idle state; "Cancel" discards without firing. Port of
// game-components gc-reset-to-defaults with fantasy chrome replaced by the
// toolcase slate/ink look.

export class ResetToDefaults extends SettingRowBase {
    // Callback mirror of the `tc-reset` event.
    onReset: (() => void) | null = null

    // Confirmation state is purely runtime — never reflected as an attribute.
    private _confirming = false

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Reset to defaults')
        super.connectedCallback()
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    protected renderControl(): string {
        const disabledAttr = this.disabled ? ' disabled' : ''

        if (this._confirming) {
            return `
                <div class="tc-reset-to-defaults__actions">
                    <button
                        type="button"
                        class="tc-reset-to-defaults__btn tc-reset-to-defaults__btn--confirm"
                        data-action="confirm"${disabledAttr}
                    >Confirm reset</button>
                    <button
                        type="button"
                        class="tc-reset-to-defaults__btn tc-reset-to-defaults__btn--cancel"
                        data-action="cancel"
                    >Cancel</button>
                </div>
            `
        }

        return `
            <div class="tc-reset-to-defaults__actions">
                <button
                    type="button"
                    class="tc-reset-to-defaults__btn tc-reset-to-defaults__btn--reset"
                    data-action="reset"${disabledAttr}
                >Reset</button>
            </div>
        `
    }

    protected bindControl(): void {
        const actions = this.querySelector('.tc-reset-to-defaults__actions')
        if (!actions) return

        actions.addEventListener('click', (e: Event) => {
            const btn = (e.target as Element).closest<HTMLButtonElement>(
                '.tc-reset-to-defaults__btn',
            )
            if (!btn || btn.disabled) return

            const action = btn.dataset.action
            if (action === 'reset') {
                this._confirming = true
                this.renderRow()
            } else if (action === 'confirm') {
                this._confirming = false
                this.renderRow()
                this.emit('tc-reset')
                if (typeof this.onReset === 'function') this.onReset()
            } else if (action === 'cancel') {
                this._confirming = false
                this.renderRow()
            }
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ResetToDefaults
    }
}
