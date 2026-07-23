import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

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
    const [value, setValue] = useState(STARTING_MARKDOWN)

    // JS-property props (multi-line content) and the tc-change event need a ref.
    const ref = useTc<HTMLElement>(
        { value: STARTING_MARKDOWN },
        { 'tc-change': (e: Event) => setValue((e as CustomEvent).detail.value) }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="MarkdownEditor"
                            description="Split-pane markdown editor with Write/Preview tabs and a formatting toolbar. Toolbar actions wrap the current selection; switching to Preview renders a small, safe markdown-to-HTML conversion."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — toolbar + write/preview tabs (tc-change)">
                                {/* @ts-ignore */}
                                <tc-markdown-editor
                                    ref={ref}
                                    label="Release notes"
                                    placeholder="Write some **Markdown**…"
                                    height="320"
                                />
                                <div className="form-text mt-2">{value.length} characters</div>
                            </tc-section-card>

                            <tc-section-card title='No toolbar (toolbar="false")'>
                                {/* @ts-ignore */}
                                <tc-markdown-editor
                                    label="Plain notes"
                                    toolbar="false"
                                    height="200"
                                    value={
                                        '## No toolbar here\n\nJust the *Write* and *Preview* tabs.'
                                    }
                                />
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                {/* @ts-ignore */}
                                <tc-markdown-editor
                                    label="Locked content"
                                    disabled
                                    height="160"
                                    value={
                                        '# Read only\n\nThis editor is **disabled** — editing and the toolbar are off.'
                                    }
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MarkdownEditorDemo
