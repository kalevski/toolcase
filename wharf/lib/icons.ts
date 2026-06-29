// Icon-name helper. `<tc-icon>` and tc-* `icon` props resolve names against
// lucide-static's PascalCase export keys (e.g. "ArrowRight"). Pass a kebab name
// (or a PascalCase lucide name straight through) and get the lucide key back.

const MAP: Record<string, string> = {
    'arrow-right': 'ArrowRight',
    box: 'Box',
    boxes: 'Boxes',
    container: 'Container',
    'key-round': 'KeyRound',
    key: 'KeyRound',
    lock: 'Lock',
    'lock-open': 'LockOpen',
    'file-lock': 'FileLock',
    flag: 'Flag',
    'sticky-note': 'StickyNote',
    'file-text': 'FileText',
    settings: 'Settings',
    users: 'Users',
    'layout-dashboard': 'LayoutDashboard',
    'scroll-text': 'ScrollText',
    server: 'Server',
    globe: 'Globe',
    plus: 'Plus',
    'plus-circle': 'CirclePlus',
    trash: 'Trash2',
    pencil: 'Pencil',
    copy: 'Copy',
    'refresh-cw': 'RefreshCw',
    eye: 'Eye',
    'eye-off': 'EyeOff',
    'log-out': 'LogOut',
    'git-branch': 'GitBranch',
    'hard-drive': 'HardDrive',
    'database-backup': 'DatabaseBackup',
    terminal: 'Terminal',
    'alert-triangle': 'TriangleAlert',
    'circle-check': 'CircleCheck',
    download: 'Download',
    upload: 'Upload',
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
    if (/^[A-Z]/.test(name)) return name
    return kebabToPascal(name)
}
