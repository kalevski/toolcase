import { useEffect, useRef } from 'react'
import { t, type MessageKey } from '../../i18n'
import { serialiseEditor } from '../../util/richtext'
import { isEmail, isHttpUrl } from '../../util/safe'

type Props = {
    /** Initial HTML; only ever our own serialiser output or escaped text. */
    initialHtml: string
    onChange: (v: { html: string; text: string }) => void
    label: string
    /** The formatting bar is folded away until the writer asks for it. */
    showToolbar?: boolean
}

const TOOLS: { cmd: string; icon: string; label: MessageKey; arg?: string }[] = [
    { cmd: 'bold', icon: 'bold', label: 'compose.bold' },
    { cmd: 'italic', icon: 'italic', label: 'compose.italic' },
    { cmd: 'underline', icon: 'underline', label: 'compose.underline' },
    { cmd: 'insertUnorderedList', icon: 'list', label: 'compose.bulletList' },
    { cmd: 'insertOrderedList', icon: 'list-ordered', label: 'compose.numberList' },
    { cmd: 'formatBlock', icon: 'quote', label: 'compose.quote', arg: 'blockquote' },
    { cmd: 'createLink', icon: 'link', label: 'compose.link' },
]

/**
 * Minimal contentEditable editor: bold, italic, lists, link, quote. Pasted
 * content is inserted as plain text so foreign markup never enters the DOM.
 */
export function RichEditor({ initialHtml, onChange, label, showToolbar = true }: Props) {
    const ref = useRef<HTMLDivElement>(null)
    const changeRef = useRef(onChange)
    changeRef.current = onChange

    useEffect(() => {
        if (ref.current) ref.current.innerHTML = initialHtml
        // initial content only; the editor is uncontrolled afterwards
    }, [])

    const emit = () => {
        if (ref.current) changeRef.current(serialiseEditor(ref.current))
    }

    const run = (cmd: string, arg?: string) => {
        ref.current?.focus()
        if (cmd === 'createLink') {
            const raw = window.prompt(t('compose.linkPrompt'), 'https://')?.trim()
            if (!raw) return
            const href: string = isEmail(raw) ? `mailto:${raw}` : raw
            if (!href.startsWith('mailto:') && !isHttpUrl(href)) return
            document.execCommand('createLink', false, href)
        } else if (cmd === 'formatBlock') {
            const inQuote = document.queryCommandValue('formatBlock').toLowerCase() === 'blockquote'
            document.execCommand('formatBlock', false, inQuote ? 'div' : arg)
        } else {
            document.execCommand(cmd, false)
        }
        emit()
    }

    return (
        <div className="wm-editor">
            <div className="wm-editor__toolbar" role="toolbar" aria-label={t('compose.toolbar')} hidden={!showToolbar}>
                {TOOLS.map((tool) => (
                    <button
                        key={tool.cmd + (tool.arg ?? '')}
                        type="button"
                        className="wm-editor__tool"
                        aria-label={t(tool.label)}
                        title={t(tool.label)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => run(tool.cmd, tool.arg)}
                    >
                        <tc-icon name={tool.icon} decorative></tc-icon>
                    </button>
                ))}
            </div>
            <div
                ref={ref}
                className="wm-editor__area"
                contentEditable
                role="textbox"
                aria-multiline="true"
                aria-label={label}
                suppressContentEditableWarning
                onInput={emit}
                onBlur={emit}
                onPaste={(e) => {
                    e.preventDefault()
                    const text = e.clipboardData.getData('text/plain')
                    document.execCommand('insertText', false, text)
                }}
                onDrop={(e) => e.preventDefault()}
            />
        </div>
    )
}
