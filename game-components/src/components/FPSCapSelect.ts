import { html, type TemplateResult } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { SettingRowBase } from './_setting-row-base.js'
import { styles } from '../styles/FPSCapSelect.styles.js'

@customElement('gc-fps-cap-select')
export class FPSCapSelect extends SettingRowBase {
    static styles = styles

    @property({ type: Number }) value = 60
    @property({ type: Array }) options: number[] = [30, 60, 75, 120, 144, 240, 0]

    constructor() { super(); this.rowLabel = 'FPS Cap' }

    protected renderControl(): TemplateResult {
        return html`<select style="width:100%;padding:6px 8px;background:rgba(15,18,24,0.7);color:var(--gc-fg);border:1px solid var(--gc-border);border-radius:4px"
            @change=${(event: Event) => this.emit('change', { value: Number((event.target as HTMLSelectElement).value) })}>
            ${this.options.map((fps) => html`<option value=${fps} ?selected=${fps === this.value}>${fps === 0 ? 'Unlimited' : fps + ' fps'}</option>`)}
        </select>`
    }
}
