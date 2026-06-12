// Inline SVG icons (lucide-static). Raw lucide strings carry fixed
// width/height attributes; icon() strips them so CSS owns sizing, marks the
// svg aria-hidden (the host button/span carries the accessible name) and keeps
// stroke="currentColor" so color flows from CSS `color`.

import { X, ChevronLeft, ChevronRight } from 'lucide-static'

export function icon(svg: string, className?: string): string {
    let out = svg
        .replace(/\s+width="[^"]*"/, ' ')
        .replace(/\s+height="[^"]*"/, ' ')
        .replace(/<svg\s/, '<svg aria-hidden="true" ')
    if (className) {
        out = out.replace(/class="/, `class="${className} `)
    }
    return out
}

export const closeIcon = icon(X)
export const chevronLeftIcon = icon(ChevronLeft)
export const chevronRightIcon = icon(ChevronRight)
