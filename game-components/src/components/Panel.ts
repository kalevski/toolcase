import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Panel.scss'

@customElement('gc-panel')
export class Panel extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Boolean }) bordered = true
    @property({ type: Boolean }) corners = true
    @property({ type: Boolean }) parchment = false
    @property({ attribute: 'nine-slice' }) nineSlice = ''
    @property({ type: Number, attribute: 'nine-slice-fill' }) nineSliceFill = 16
    @property() padding = '16px'

    render() {
        const styleVars: Record<string, string> = { '--gc-padding': this.padding }
        const classes = ['panel']
        if (this.parchment && !this.nineSlice) {
            classes.push('parchment', 'bordered')
            if (this.corners) classes.push('with-corners')
        } else if (this.bordered && !this.nineSlice) {
            classes.push('bordered')
            if (this.corners) classes.push('with-corners')
        }
        const inline: Record<string, string> = { ...styleVars }
        if (this.nineSlice) {
            classes.push('nine-slice')
            inline['border-image-source'] = `url("${this.nineSlice}")`
            inline['border-image-slice'] = String(this.nineSliceFill)
            inline['border-image-width'] = `${this.nineSliceFill}px`
            inline['border-width'] = `${this.nineSliceFill}px`
        }
        const styleString = Object.entries(inline).map(([k, v]) => `${k}: ${v}`).join('; ')
        return html`<div class="${classes.join(' ')}" style="${styleString}"><slot></slot></div>`
    }
}
