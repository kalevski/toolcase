import { html, nothing, type TemplateResult } from 'lit'
import { property } from 'lit/decorators.js'
import { GameElement } from '../base.js'

export abstract class SettingRowBase extends GameElement {
    @property({ attribute: 'row-label' }) rowLabel = ''
    @property() description = ''

    protected abstract renderControl(): TemplateResult

    render() {
        return html`
            <div>
                <div>${this.rowLabel}</div>
                ${this.description ? html`<div class="desc">${this.description}</div>` : nothing}
            </div>
            <div class="control">${this.renderControl()}</div>`
    }
}
