import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/Panel.styles.js'

@customElement('gc-panel')
export class Panel extends GameElement {
    static styles = styles

    @property({ type: Boolean }) bordered = true
    @property({ attribute: 'nine-slice' }) nineSlice = ''
    @property({ type: Number, attribute: 'nine-slice-fill' }) nineSliceFill = 16
    @property() padding = '16px'

    render() {
        const styleVars: Record<string, string> = { '--gc-padding': this.padding }
        const classes = ['panel']
        if (this.bordered && !this.nineSlice) classes.push('bordered')
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
