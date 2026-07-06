'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTcEvents, detailValue } from '@/lib/tc'

function lintFrontmatter(content: string): string | null {
    const fm = content.match(/^---\n([\s\S]*?)\n---/)
    if (!fm) return 'Missing YAML frontmatter (--- … ---) with name and description.'
    if (!/^\s*name\s*:/im.test(fm[1])) return 'Frontmatter is missing a `name:` field.'
    if (!/^\s*description\s*:/im.test(fm[1])) return 'Frontmatter is missing a `description:` field.'
    return null
}

export function SkillEditorClient({
    isNew,
    initialName,
    initialContent,
}: {
    isNew: boolean
    initialName: string
    initialContent: string
}) {
    const router = useRouter()
    const [name, setName] = useState(initialName)
    const [content, setContent] = useState(initialContent)
    const [saving, setSaving] = useState(false)

    const nameRef = useTcEvents<HTMLElement>({ input: (e) => setName((e.target as HTMLInputElement).value) })
    const editorRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setContent(detailValue<string>(e)) })

    const lintError = lintFrontmatter(content)

    const goSkills = (e?: React.MouseEvent) => {
        e?.preventDefault()
        router.push('/skills')
    }

    const onSave = async () => {
        if (isNew && !/^[a-z0-9-]+$/.test(name)) {
            toast.error('Skill name must match ^[a-z0-9-]+$')
            return
        }
        if (lintError) {
            toast.error(lintError)
            return
        }
        setSaving(true)
        try {
            if (isNew) {
                await apiFetch('/api/skills', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, content }),
                })
            } else {
                await apiFetch(`/api/skills/${initialName}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content }),
                })
            }
            toast.success('Saved')
            router.push('/skills')
        } catch (e) {
            toast.error(describeApiError(e))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="taskforge-page">
            <tc-breadcrumb>
                <tc-breadcrumb-item href="/skills" onClick={goSkills}>
                    Skills
                </tc-breadcrumb-item>
                <tc-breadcrumb-item active>{isNew ? 'New' : initialName}</tc-breadcrumb-item>
            </tc-breadcrumb>
            <tc-rich-page-header
                title-text={isNew ? 'New skill' : initialName}
                icon-name="Lightbulb"
                icon-color="amber"
            />

            {isNew && <tc-input ref={nameRef} label="Skill name" placeholder="my-skill" value={name} />}

            {lintError && <tc-banner variant="warning">{lintError}</tc-banner>}

            <tc-markdown-editor ref={editorRef} value={content} height="460" label="SKILL.md" />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <tc-button variant="primary" loading={saving || undefined} onClick={onSave}>
                    Save
                </tc-button>
                <tc-button variant="secondary" outline onClick={goSkills}>
                    Cancel
                </tc-button>
            </div>
        </div>
    )
}
