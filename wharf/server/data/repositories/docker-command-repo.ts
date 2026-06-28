// Docker-run command repository — SQL for the `docker_command` table (planning
// §4 v8, §7.1). Stores the structured DockerSpec as JSON in `spec_json`; the
// Raw->DockerCommand map JSON.parses it back into `spec`. SQL + map only.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { DockerCommand, DockerSpec } from '@/server/domain/types'

interface Raw {
    id: string
    project_id: string
    name: string
    spec_json: string
    instance_id: string | null
    created_by: number
    created_at: string
    updated_at: string
}

function map(r: Raw): DockerCommand {
    return {
        id: r.id,
        projectId: r.project_id,
        name: r.name,
        spec: JSON.parse(r.spec_json) as DockerSpec,
        instanceId: r.instance_id ?? undefined,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

export function listByProject(projectId: string): DockerCommand[] {
    return allRows<Raw>(
        'SELECT * FROM docker_command WHERE project_id = ? ORDER BY name',
        projectId,
    ).map(map)
}

export function byId(id: string): DockerCommand | undefined {
    const r = getRow<Raw>('SELECT * FROM docker_command WHERE id = ?', id)
    return r ? map(r) : undefined
}

export function byName(projectId: string, name: string): DockerCommand | undefined {
    const r = getRow<Raw>(
        'SELECT * FROM docker_command WHERE project_id = ? AND name = ?',
        projectId,
        name,
    )
    return r ? map(r) : undefined
}

export function insert(c: DockerCommand): void {
    prep(
        `INSERT INTO docker_command
            (id, project_id, name, spec_json, instance_id, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        c.id,
        c.projectId,
        c.name,
        JSON.stringify(c.spec),
        c.instanceId ?? null,
        c.createdBy,
        c.createdAt,
        c.updatedAt,
    )
}

export function update(
    id: string,
    fields: { name?: string; specJson?: string; instanceId?: string | null; updatedAt: string },
): void {
    const sets: string[] = []
    const params: (string | number | null)[] = []
    if (fields.name !== undefined) {
        sets.push('name = ?')
        params.push(fields.name)
    }
    if (fields.specJson !== undefined) {
        sets.push('spec_json = ?')
        params.push(fields.specJson)
    }
    if (fields.instanceId !== undefined) {
        sets.push('instance_id = ?')
        params.push(fields.instanceId)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE docker_command SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM docker_command WHERE id = ?').run(id)
}
