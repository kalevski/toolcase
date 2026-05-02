import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/CreditsList.styles.js'
import type { CreditsSection } from './CreditsScroll.js'

@customElement('gc-credits-list')
export class CreditsList extends GameElement {
    static styles = styles

    @property({ type: Array }) sections: CreditsSection[] = []

    render() {
        return html`${this.sections.map((s) => html`<div>
            <div class="role">${s.role}</div>
            <ul>${s.names.map((n) => html`<li>${n}</li>`)}</ul>
        </div>`)}`
    }
}
