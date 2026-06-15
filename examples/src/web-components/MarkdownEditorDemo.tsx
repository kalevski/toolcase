import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const STARTING_MARKDOWN = [
    '# Release notes',
    '',
    'We shipped **v2.4** with a few highlights:',
    '',
    '- Faster cold start',
    '- New `tc-markdown-editor` component',
    '- Bug fixes',
    '',
    '> Heads up: the old editor is deprecated.',
    '',
    'See the [changelog](https://example.com/changelog) for details.',
    '',
    '```ts',
    'const editor = document.querySelector("tc-markdown-editor")',
    'editor.value = "# Hello"',
    '```',
].join('\n')

const MarkdownEditorDemo: React.FC = () => {
    const ref = useRef<any>(null)
    const [value, setValue] = useState(STARTING_MARKDOWN)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        // JS-property props (multi-line content) and the tc-change event need a ref.
        el.value = STARTING_MARKDOWN
        const handler = (e: Event) => setValue((e as CustomEvent).detail.value)
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="MarkdownEditor"
                            description="Split-pane markdown editor with Write/Preview tabs and a formatting toolbar. Toolbar actions wrap the current selection; switching to Preview renders a small, safe markdown-to-HTML conversion."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Default — toolbar + write/preview tabs (tc-change)">
                                {/* @ts-ignore */}
                                <tc-markdown-editor
                                    ref={ref}
                                    label="Release notes"
                                    placeholder="Write some **Markdown**…"
                                    height="320"
                                />
                                <div className="form-text mt-2">{value.length} characters</div>
                            </SectionCard>

                            <SectionCard title="No toolbar (toolbar=&quot;false&quot;)">
                                {/* @ts-ignore */}
                                <tc-markdown-editor
                                    label="Plain notes"
                                    toolbar="false"
                                    height="200"
                                    value={'## No toolbar here\n\nJust the *Write* and *Preview* tabs.'}
                                />
                            </SectionCard>

                            <SectionCard title="Disabled">
                                {/* @ts-ignore */}
                                <tc-markdown-editor
                                    label="Locked content"
                                    disabled
                                    height="160"
                                    value={'# Read only\n\nThis editor is **disabled** — editing and the toolbar are off.'}
                                />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MarkdownEditorDemo
