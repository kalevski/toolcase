// Notes agent (§7.3): prompt assembly for the `note-writer` agent kind — edit a
// named note in place, or create exactly one new note. The agent run itself is
// owned by the AgentSessionManager (streaming). Pattern of knowledge.ts.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import { projectNotesDir, projectPath } from '@/server/infrastructure/fs-workspace'

const FALLBACK_BODY = [
    'You manage free-form Markdown notes for this project. Notes live in the `notes/` directory',
    'at the project root (a sibling of `repo/`). Start every note with an H1 title.',
    'You may read `repo/` and `knowledge/` for context. Do not modify anything outside `notes/`.',
    'Do not stage, commit, or push. Emit no other output.',
].join(' ')

async function skillBody(): Promise<string> {
    try {
        const raw = await fs.readFile(path.join(config.appSkillsDir, 'note-writer', 'SKILL.md'), 'utf8')
        return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
    } catch {
        return FALLBACK_BODY
    }
}

/**
 * Assemble the note-writer prompt (cwd = project root). With `targetNote`, the
 * agent edits that file in place; without, it creates exactly one new note.
 */
export async function buildNoteWriterPrompt(
    project: string,
    instruction: string,
    targetNote?: string,
): Promise<{ cwd: string; prompt: string }> {
    const cwd = projectPath(project)
    await fs.mkdir(projectNotesDir(project), { recursive: true })
    const body = await skillBody()

    const target = targetNote
        ? [
              `EDIT the existing file \`notes/${targetNote}\` in place. Preserve anything the`,
              'instruction does not ask to change. Do not create or modify other files.',
          ].join('\n')
        : [
              'Create exactly ONE new Markdown file under `notes/`. Pick a concise kebab-case',
              'filename that does not collide with an existing note.',
          ].join('\n')

    const prompt = [body, '', target, '', '--- INSTRUCTION ---', instruction].join('\n')

    return { cwd, prompt }
}
