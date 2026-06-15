import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LANGUAGES = [
    'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Java', 'C#', 'Ruby', 'Swift', 'Kotlin',
]

const FRAMEWORKS = ['React', 'Vue', 'Svelte', 'Angular', 'Solid']

const TagInputDemo: React.FC = () => {
    const pickerRef = useRef<any>(null)
    const cappedRef = useRef<any>(null)
    const disabledRef = useRef<any>(null)

    const [tags, setTags] = useState<string[]>(['TypeScript'])

    useEffect(() => {
        const el = pickerRef.current
        if (!el) return
        el.recommendations = LANGUAGES
        el.defaultValue = ['TypeScript']

        const handler = (e: Event) => {
            const next = (e as CustomEvent<{ tags: string[] }>).detail.tags
            setTags(next)
            console.log('tc-change:', next)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = cappedRef.current
        if (el) {
            el.recommendations = FRAMEWORKS
            el.defaultValue = ['React', 'Svelte']
        }
    }, [])

    useEffect(() => {
        const el = disabledRef.current
        if (el) {
            el.recommendations = LANGUAGES
            el.defaultValue = ['Go', 'Rust']
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="TagInput"
                            description="Tag input with autocomplete recommendations and optional create-on-type. Typed text filters the suggestion list; Enter/comma commits, Backspace on an empty field removes the last tag. Fires tc-change with the updated tags array."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Recommendations + allow-create">
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
                            </SectionCard>

                            <SectionCard title="Capped at 3 tags (max-tags)">
                                {/* @ts-ignore */}
                                <tc-tag-input
                                    ref={cappedRef}
                                    label="Frameworks"
                                    placeholder="Pick up to three…"
                                    max-tags="3"
                                />
                            </SectionCard>

                            <SectionCard title="Disabled">
                                {/* @ts-ignore */}
                                <tc-tag-input ref={disabledRef} label="Stack" disabled />
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-tag-input label="Tags" loading />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TagInputDemo
