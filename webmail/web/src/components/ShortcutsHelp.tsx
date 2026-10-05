import { t, type MessageKey } from '../i18n'
import { Dialog } from './Dialog'

export const SHORTCUTS: [string, MessageKey][] = [
    ['c', 'shortcuts.compose'],
    ['j', 'shortcuts.next'],
    ['k', 'shortcuts.prev'],
    ['e', 'shortcuts.archive'],
    ['#', 'shortcuts.delete'],
    ['r', 'shortcuts.reply'],
    ['a', 'shortcuts.replyAll'],
    ['f', 'shortcuts.forward'],
    ['/', 'shortcuts.search'],
    ['?', 'shortcuts.help'],
    ['Esc', 'shortcuts.escape'],
]

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} title={t('shortcuts.title')} onClose={onClose} size="sm">
            <dl className="wm-shortcuts">
                {SHORTCUTS.map(([key, label]) => (
                    <div key={key} className="wm-shortcuts__row">
                        <dt>
                            <tc-kbd>{key}</tc-kbd>
                        </dt>
                        <dd>{t(label)}</dd>
                    </div>
                ))}
            </dl>
        </Dialog>
    )
}
