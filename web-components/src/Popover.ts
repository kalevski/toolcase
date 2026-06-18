import { Popover as BsPopover } from './internal/Popover'
import { OverlayTrigger, type OverlayOptions, type OverlayPlugin } from './internal/overlay-trigger'

const TAG_NAME = 'tc-popover'

/**
 * tc-popover — wraps a Bootstrap Popover plugin around this element's first
 * child. Built on the shared {@link OverlayTrigger} scaffold; the only popover
 * specifics are the default `click` trigger, the `.bs.popover` event namespace,
 * and passing `title` + `content` through as separate plugin options.
 */
export class Popover extends OverlayTrigger {
    protected get defaultTrigger(): string {
        return 'click'
    }

    protected get eventNs(): string {
        return 'popover'
    }

    protected createPlugin(triggerEl: HTMLElement, options: OverlayOptions): OverlayPlugin {
        return new BsPopover(triggerEl, {
            title: options.title,
            content: options.content,
            placement: options.placement as any,
            trigger: options.trigger as any,
            html: options.html,
        }) as unknown as OverlayPlugin
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Popover
    }
}
