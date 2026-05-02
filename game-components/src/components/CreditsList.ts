import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/CreditsList.scss'
import type { CreditsSection } from './CreditsScroll.js'

@customElement('gc-credits-list')
export class CreditsList extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) sections: CreditsSection[] = []

    render() {
        return html`${this.sections.map((s) => html`<div>
            <div class="role">${s.role}</div>
            <ul>${s.names.map((n) => html`<li>${n}</li>`)}</ul>
        </div>`)}`
    }
}
