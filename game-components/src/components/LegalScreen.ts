import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/LegalScreen.scss'
import './NavButton.js'

export interface LegalSection { id: string; title: string; body: string }

@customElement('gc-legal-screen')
export class LegalScreen extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) sections: LegalSection[] = []
    @property({ attribute: 'initial-section' }) initialSection = ''
    @property({ attribute: 'screen-title' }) screenTitle = 'Legal'
    @property({ type: Boolean, attribute: 'show-accept' }) showAccept = false

    @state() private _activeId: string | null = null

    render() {
        const current = this._activeId ?? this.initialSection ?? this.sections[0]?.id
        const active = this.sections.find((section) => section.id === current)
        return html`
            <div class="head">
                <h2>${this.screenTitle}</h2>
                <gc-nav-button kind="close" @click=${() => this.emit('close')}></gc-nav-button>
            </div>
            <ul>${this.sections.map((s) => html`<li><button class=${s.id === current ? 'active' : ''} @click=${() => { this._activeId = s.id }}>${s.title}</button></li>`)}</ul>
            <div class="body">${active?.body ?? ''}</div>
            ${this.showAccept ? html`<div class="accept"><button @click=${() => this.emit('accept')}>Accept</button></div>` : nothing}`
    }
}
