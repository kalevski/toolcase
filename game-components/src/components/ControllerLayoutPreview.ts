import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ControllerLayoutPreview.styles.js'

@customElement('gc-controller-layout-preview')
export class ControllerLayoutPreview extends GameElement {
    static styles = styles

    @property() layout: 'xbox' | 'playstation' | 'nintendo' | 'generic' = 'xbox'

    render() {
        return html`<div class="icon">🎮</div><div class="label">${this.layout} layout</div>`
    }
}
