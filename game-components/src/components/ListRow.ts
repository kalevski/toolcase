import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/ListRow.scss'

@customElement('gc-list-row')
export class ListRow extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Boolean, reflect: true }) selected = false
    @property() accent = 'var(--fg-gold)'

    render() {
        return html`<style>:host { --gc-row-accent: ${this.accent}; }</style>
            <div
                class="row ${this.selected ? 'selected' : ''}"
                @click=${() => this.emit('select')}
            ><slot></slot></div>`
    }
}
