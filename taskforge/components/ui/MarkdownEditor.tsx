'use client'

import React, { useCallback, useId, useState } from 'react'
import { Icon } from './Icon'

// ── Minimal Markdown → HTML ───────────────────────────────────────────────────

function markdownToHtml(md: string): string {
    const html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
        .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^\s*[-*+] (.+)$/gm, '<li>$1</li>')
        .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/^---+$/gm, '<hr>')
        .replace(/\n{2,}/g, '</p><p>')

    return `<p>${html}</p>`.replace(/<p>\s*<\/p>/g, '').replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

interface ToolbarAction {
    label: string
    icon: string
    wrap: [string, string]
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
    { label: 'Bold', icon: 'type-bold', wrap: ['**', '**'] },
    { label: 'Italic', icon: 'type-italic', wrap: ['*', '*'] },
    { label: 'Code', icon: 'code', wrap: ['`', '`'] },
    { label: 'Heading', icon: 'type-h1', wrap: ['# ', ''] },
    { label: 'Link', icon: 'link-45deg', wrap: ['[', '](url)'] },
    { label: 'Quote', icon: 'chat-quote', wrap: ['> ', ''] },
    { label: 'List', icon: 'list-ul', wrap: ['- ', ''] },
]

export interface MarkdownEditorProps {
    value?: string
    onChange?: (value: string) => void
    placeholder?: string
    height?: number | string
    toolbar?: boolean
    label?: string
    disabled?: boolean
    className?: string
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value = '',
    onChange,
    placeholder = 'Write some **Markdown**…',
    height = 360,
    toolbar = true,
    label,
    disabled = false,
    className = '',
}) => {
    const genId = useId()
    const editorId = `md-editor-${genId.replace(/[^a-zA-Z0-9_-]/g, '')}`
    const [tab, setTab] = useState<'write' | 'preview'>('write')
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)

    const applyWrap = useCallback(
        (wrap: [string, string]) => {
            const el = textareaRef.current
            if (!el) return
            const start = el.selectionStart
            const end = el.selectionEnd
            const selectedText = value.slice(start, end)
            const selected = selectedText !== '' ? selectedText : wrap[1] === '' ? '' : 'text'
            const newVal = value.slice(0, start) + wrap[0] + selected + wrap[1] + value.slice(end)
            onChange?.(newVal)
            setTimeout(() => {
                el.focus()
                el.setSelectionRange(start + wrap[0].length, start + wrap[0].length + selected.length)
            }, 0)
        },
        [value, onChange],
    )

    const heightStyle = typeof height === 'number' ? `${height}px` : height
    const htmlContent = markdownToHtml(value)

    const rootClass = [
        'component component-markdown-editor',
        disabled ? 'component-markdown-editor--disabled' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={rootClass}>
            {label && (
                <label htmlFor={editorId} className="component-form-label component-markdown-editor__label">
                    {label}
                </label>
            )}

            <div className="component-markdown-editor__shell" style={{ height: heightStyle }}>
                <div className="component-markdown-editor__tabs" role="tablist">
                    <button
                        role="tab"
                        type="button"
                        className={`component-markdown-editor__tab${tab === 'write' ? ' component-markdown-editor__tab--active' : ''}`}
                        aria-selected={tab === 'write'}
                        onClick={() => setTab('write')}
                    >
                        Write
                    </button>
                    <button
                        role="tab"
                        type="button"
                        className={`component-markdown-editor__tab${tab === 'preview' ? ' component-markdown-editor__tab--active' : ''}`}
                        aria-selected={tab === 'preview'}
                        onClick={() => setTab('preview')}
                    >
                        Preview
                    </button>
                    {toolbar && tab === 'write' && (
                        <div className="component-markdown-editor__toolbar" role="group" aria-label="Formatting">
                            {TOOLBAR_ACTIONS.map((action) => (
                                <button
                                    key={action.label}
                                    type="button"
                                    className="component-markdown-editor__toolbar-btn"
                                    title={action.label}
                                    aria-label={action.label}
                                    disabled={disabled}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        applyWrap(action.wrap)
                                    }}
                                >
                                    <Icon name={action.icon} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {tab === 'write' && (
                    <textarea
                        ref={textareaRef}
                        id={editorId}
                        className="component-markdown-editor__textarea"
                        value={value}
                        placeholder={placeholder}
                        disabled={disabled}
                        spellCheck={true}
                        onChange={(e) => onChange?.(e.target.value)}
                    />
                )}

                {tab === 'preview' && (
                    <div className="component-markdown-editor__preview" aria-label="Preview">
                        {value.trim() ? (
                            <iframe
                                className="component-markdown-editor__preview-frame"
                                title="Markdown preview"
                                sandbox="allow-same-origin"
                                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1e293b;padding:1rem;margin:0}
code{background:#f1f5f9;padding:0.15em 0.35em;font-size:0.9em}
blockquote{border-left:3px solid #e2e8f0;margin:0;padding-left:1rem;color:#64748b}
h1,h2,h3,h4,h5,h6{line-height:1.3;margin-top:1rem}
a{color:#3b82f6}
ul{padding-left:1.5rem}
hr{border:none;border-top:1px solid #e2e8f0}
</style></head><body>${htmlContent}</body></html>`}
                            />
                        ) : (
                            <p className="component-markdown-editor__empty-preview">Nothing to preview.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
