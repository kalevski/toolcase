import {
    TextFieldBase,
    TEXT_FIELD_ATTRIBUTES,
    esc,
    type ControlRenderContext,
} from './internal/text-field-base'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-input'

export type InputSize = 'sm' | 'lg'
export type InputState = 'valid' | 'invalid'

/**
 * tc-input — a labelled Bootstrap text input with validation feedback and help
 * text. Built on the shared {@link TextFieldBase} frame; the input-specific bits
 * are the `type` attribute and the `<input>` control element.
 */
export class Input extends TextFieldBase {
    static get observedAttributes(): string[] {
        return ['type', ...TEXT_FIELD_ATTRIBUTES]
    }

    get type(): string {
        return this.getAttribute('type') ?? 'text'
    }
    set type(v: string) {
        setAttr(this, 'type', v)
    }

    protected get controlSelector(): string {
        return 'input'
    }

    protected renderControl(ctx: ControlRenderContext): string {
        return (
            `<input id="${ctx.id}" type="${esc(this.type)}" class="${ctx.classAttr}"` +
            ` placeholder="${esc(ctx.placeholder)}" value="${esc(ctx.value)}"${ctx.commonAttrs}>`
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Input
    }
}
