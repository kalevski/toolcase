import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/ControllerLayoutPreview.scss'

@customElement('gc-controller-layout-preview')
export class ControllerLayoutPreview extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() layout: 'xbox' | 'playstation' | 'nintendo' | 'generic' = 'xbox'

    render() {
        return html`<div class="icon">🎮</div><div class="label">${this.layout} layout</div>`
    }
}
