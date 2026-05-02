import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/Grid.styles.js'

@customElement('gc-grid')
export class Grid extends GameElement {
    static styles = styles

    @property() columns = '4'
    @property() rows = ''
    @property() gap = '4px'
    @property({ attribute: 'cell-size' }) cellSize = ''

    render() {
        const cellPart = this.cellSize || '1fr'
        const cols = /^\d+$/.test(this.columns) ? `repeat(${this.columns}, ${cellPart})` : this.columns
        const rws = this.rows ? (/^\d+$/.test(this.rows) ? `repeat(${this.rows}, ${cellPart})` : this.rows) : 'auto'
        return html`<style>:host { --gc-cols: ${cols}; --gc-rows: ${rws}; --gc-gap: ${this.gap}; }</style><slot></slot>`
    }
}
