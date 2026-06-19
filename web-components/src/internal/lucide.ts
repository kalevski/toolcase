import * as LucideIcons from 'lucide-static'
import { icon } from '../icons'

// Resolve a lucide icon by kebab-case (or PascalCase) name to an inline-SVG
// string, processed through icon() so CSS owns sizing/color. Returns '' when the
// name is unknown. Single source of truth for the kebab→Pascal lookup that was
// copy-pasted across the library.
export function lucideByName(name: string, className?: string): string {
    const pascal = name
        .split('-')
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')
    const svg = (LucideIcons as Record<string, string>)[pascal]
    if (!svg) return ''
    return icon(svg, className)
}
