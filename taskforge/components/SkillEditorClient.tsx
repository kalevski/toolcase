'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heading, Breadcrumb, Input, MarkdownEditor, Button, Banner, toast } from '@toolcase/react-components'

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

    const lintError = lintFrontmatter(content)

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
            const res = isNew
                ? await fetch('/api/skills', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name, content }),
                  })
                : await fetch(`/api/skills/${initialName}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content }),
                  })
            if (res.ok) {
                toast.success('Saved')
                router.push('/skills')
            } else {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Save failed')
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Breadcrumb
                items={[{ label: 'Skills', onClick: () => router.push('/skills') }, { label: isNew ? 'New' : initialName }]}
            />
            <Heading as="h1">{isNew ? 'New skill' : initialName}</Heading>

            {isNew && (
                <Input
                    label="Skill name"
                    placeholder="my-skill"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            )}

            {lintError && <Banner variant="warning" icon="exclamation-triangle">{lintError}</Banner>}

            <MarkdownEditor value={content} onChange={setContent} height={460} label="SKILL.md" />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="primary" loading={saving} onClick={onSave}>
                    Save
                </Button>
                <Button variant="secondary" outline onClick={() => router.push('/skills')}>
                    Cancel
                </Button>
            </div>
        </div>
    )
}
