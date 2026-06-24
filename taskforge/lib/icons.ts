// Bootstrap-icons → Lucide name map.
//
// The app historically used bootstrap-icons (`bi-<kebab>`); `<tc-icon>` resolves
// names directly against lucide-static's PascalCase export keys (e.g. "ArrowRight").
// `tcIcon('box-arrow-right')` → 'LogOut'. Pass the result as `<tc-icon name=…>`.
//
// Visual note: Lucide glyphs are line icons and differ from bootstrap-icons.
// Unmapped names fall back to a best-effort kebab→Pascal guess + a dev warning;
// an unknown lucide key renders an empty (inert) glyph, so watch for blanks.

const MAP: Record<string, string> = {
    'arrow-right': 'ArrowRight',
    github: 'GitBranch', // Lucide has no GitHub brand icon
    x: 'X',
    'x-lg': 'X',
    'box-arrow-right': 'LogOut',
    'chat-quote': 'MessageSquareQuote',
    'check-circle': 'CircleCheck',
    'clock-history': 'History',
    code: 'Code',
    collection: 'Library',
    cpu: 'Cpu',
    'currency-dollar': 'DollarSign',
    'diagram-2': 'GitFork',
    'exclamation-octagon': 'OctagonAlert',
    'exclamation-triangle': 'TriangleAlert',
    folder2: 'Folder',
    'grid-1x2': 'LayoutDashboard',
    'moon-fill': 'Moon',
    'pause-circle-fill': 'CirclePause',
    'play-circle-fill': 'CirclePlay',
    'heart-pulse': 'HeartPulse',
    'hourglass-split': 'Hourglass',
    inbox: 'Inbox',
    'info-circle': 'Info',
    'journal-check': 'BookCheck',
    'journal-text': 'BookText',
    lightbulb: 'Lightbulb',
    'link-45deg': 'Link',
    'list-task': 'ListChecks',
    'list-ul': 'List',
    lock: 'Lock',
    moon: 'Moon',
    pause: 'Pause',
    pencil: 'Pencil',
    people: 'Users',
    'play-circle': 'CirclePlay',
    'plus-circle': 'CirclePlus',
    robot: 'Bot',
    'skip-forward': 'SkipForward',
    sliders: 'SlidersHorizontal',
    speedometer2: 'Gauge',
    stickies: 'StickyNote',
    'stop-fill': 'Square',
    trash: 'Trash2',
    'type-bold': 'Bold',
    'type-h1': 'Heading1',
    'type-italic': 'Italic',
}

function kebabToPascal(name: string): string {
    return name
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')
}

export function tcIcon(name: string): string {
    const mapped = MAP[name]
    if (mapped) return mapped
    // Already PascalCase (e.g. a lucide name passed straight through)?
    if (/^[A-Z]/.test(name)) return name
    if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn(`[tcIcon] no mapping for "${name}" — falling back to a kebab→Pascal guess`)
    }
    return kebabToPascal(name)
}
