import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement, type ItemRarity } from '../base.js'
import stylesText from '../../style/RarityChip.scss'

@customElement('gc-rarity-chip')
export class RarityChip extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() rarity: ItemRarity = 'common'

    render() {
        return html`<span class="chip r-${this.rarity}">${this.rarity}</span>`
    }
}
