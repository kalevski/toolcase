import {
    TextFieldBase,
    TEXT_FIELD_ATTRIBUTES,
    esc,
    type ControlRenderContext,
} from './internal/text-field-base'

const TAG_NAME = 'tc-textarea'

export type TextareaSize = 'sm' | 'lg'
export type TextareaState = 'valid' | 'invalid'

/**
 * tc-textarea — a labelled Bootstrap textarea with validation feedback and help
 * text. Built on the shared {@link TextFieldBase} frame; the textarea-specific
 * bits are the `rows` attribute and the `<textarea>` control element.
 */
export class Textarea extends TextFieldBase {
    static get observedAttributes(): string[] {
        return [...TEXT_FIELD_ATTRIBUTES, 'rows']
    }

    get rows(): number {
        const v = parseInt(this.getAttribute('rows') ?? '', 10)
        return isNaN(v) || v < 1 ? 3 : v
    }
    set rows(v: number) {
        this.setAttribute('rows', String(v))
    }

    protected get controlSelector(): string {
        return 'textarea'
    }

    protected renderControl(ctx: ControlRenderContext): string {
        return (
            `<textarea id="${ctx.id}" class="${ctx.classAttr}"` +
            ` rows="${this.rows}" placeholder="${esc(ctx.placeholder)}"${ctx.commonAttrs}>` +
            `${esc(ctx.value)}</textarea>`
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Textarea
    }
}
