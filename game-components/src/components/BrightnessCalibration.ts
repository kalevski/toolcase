import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/BrightnessCalibration.styles.js'

@customElement('gc-brightness-calibration')
export class BrightnessCalibration extends GameElement {
    static styles = styles

    @property({ type: Number }) value = 1

    render() {
        return html`<style>:host { --gc-brightness: ${this.value}; }</style>
            <div>Adjust until the symbol is barely visible</div>
            <div class="test">◆ ◆ ◆</div>
            <input type="range" min="0.5" max="1.5" step="0.01" .value=${String(this.value)}
                @input=${(event: Event) => this.emit('change', { value: Number((event.target as HTMLInputElement).value) })} />`
    }
}
