import { SelectRow } from './SelectRow'

const TAG_NAME = 'gc-fps-cap-select'

export class FPSCapSelect extends SelectRow {

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'FPS Cap')
        if (this.options.length === 0) {
            this.options = [
                { value: '30', label: '30 FPS' },
                { value: '60', label: '60 FPS' },
                { value: '120', label: '120 FPS' },
                { value: '144', label: '144 FPS' },
                { value: '240', label: '240 FPS' },
                { value: '0', label: 'Unlimited' },
            ]
        }
        super.connectedCallback()
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, FPSCapSelect)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FPSCapSelect
    }
}
