import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const LANGUAGES = [
    'TypeScript',
    'JavaScript',
    'Python',
    'Rust',
    'Go',
    'Java',
    'C#',
    'Ruby',
    'Swift',
    'Kotlin',
]

const FRAMEWORKS = ['React', 'Vue', 'Svelte', 'Angular', 'Solid']

const TagInputDemo: React.FC = () => {
    const [tags, setTags] = useState<string[]>(['TypeScript'])

    const pickerRef = useTc<HTMLElement>(
        { recommendations: LANGUAGES, defaultValue: ['TypeScript'] },
        {
            'tc-change': (e: Event) => {
                const next = (e as CustomEvent<{ value: string[] }>).detail.value
                setTags(next)
                console.log('tc-change:', next)
            },
        }
    )

    const cappedRef = useTc<HTMLElement>({
        recommendations: FRAMEWORKS,
        defaultValue: ['React', 'Svelte'],
    })

    const disabledRef = useTc<HTMLElement>({
        recommendations: LANGUAGES,
        defaultValue: ['Go', 'Rust'],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="TagInput"
                            description="Tag input with autocomplete recommendations and optional create-on-type. Typed text filters the suggestion list; Enter/comma commits, Backspace on an empty field removes the last tag. Fires tc-change with the updated tags array."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Recommendations + allow-create">
                                {/* @ts-ignore */}
                                <tc-tag-input
                                    ref={pickerRef}
                                    label="Languages"
                                    placeholder="Add a language…"
                                    allow-create
                                />
                                <div className="form-text mt-2">
                                    Current tags: {tags.length ? tags.join(', ') : '(none)'}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Capped at 3 tags (max-tags)">
                                {/* @ts-ignore */}
                                <tc-tag-input
                                    ref={cappedRef}
                                    label="Frameworks"
                                    placeholder="Pick up to three…"
                                    max-tags="3"
                                />
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                {/* @ts-ignore */}
                                <tc-tag-input ref={disabledRef} label="Stack" disabled />
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-tag-input label="Tags" loading />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TagInputDemo
