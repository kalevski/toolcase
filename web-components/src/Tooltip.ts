import { Tooltip as BsTooltip } from './internal/Tooltip'
import { OverlayTrigger, type OverlayOptions, type OverlayPlugin } from './internal/overlay-trigger'

const TAG_NAME = 'tc-tooltip'

/**
 * tc-tooltip — wraps a Bootstrap Tooltip plugin around this element's first
 * child. Built on the shared {@link OverlayTrigger} scaffold; the only tooltip
 * specifics are the default `hover focus` trigger, the `.bs.tooltip` event
 * namespace, and folding `content` into the plugin's `title` option.
 */
export class Tooltip extends OverlayTrigger {
    protected get defaultTrigger(): string {
        return 'hover focus'
    }

    protected get eventNs(): string {
        return 'tooltip'
    }

    protected createPlugin(triggerEl: HTMLElement, options: OverlayOptions): OverlayPlugin {
        return new BsTooltip(triggerEl, {
            title: options.title || options.content,
            placement: options.placement as any,
            trigger: options.trigger as any,
            html: options.html,
        }) as unknown as OverlayPlugin
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Tooltip
    }
}
