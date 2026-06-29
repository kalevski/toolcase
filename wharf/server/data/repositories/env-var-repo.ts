// Environment-variables repository — SQL for the `env_var` table (planning §4 v5,
// v9). Two scopes via nullable instance_id: NULL = environment-scope baseline, set
// = instance-scope override. Stores the literal value as ciphertext (value_enc);
// the service encrypts/decrypts via cipher. Repo returns raw rows; the service
// builds the decrypted/joined EnvVar domain shape.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { EnvVarSource } from '@/server/domain/types'

/** A raw env_var row (value still ciphertext). The service decrypts + joins the secret name. */
export interface EnvVarRow {
    id: string
    projectId: string
    environmentId: string
    instanceId?: string
    key: string
    source: EnvVarSource
    valueEnc?: string
    secretId?: string
    description?: string
    required: boolean
    createdAt: string
    updatedAt: string
}

interface Raw {
    id: string
    project_id: string
    environment_id: string
    instance_id: string | null
    key: string
    source: string
    value_enc: string | null
    secret_id: string | null
    description: string | null
    required: number
    created_at: string
    updated_at: string
}

function map(r: Raw): EnvVarRow {
    return {
        id: r.id,
        projectId: r.project_id,
        environmentId: r.environment_id,
        instanceId: r.instance_id ?? undefined,
        key: r.key,
        source: r.source as EnvVarSource,
        valueEnc: r.value_enc ?? undefined,
        secretId: r.secret_id ?? undefined,
        description: r.description ?? undefined,
        required: r.required === 1,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}

/** Environment-scope baseline rows (instance_id IS NULL). */
export function listEnvironmentScope(environmentId: string): EnvVarRow[] {
    return allRows<Raw>(
        'SELECT * FROM env_var WHERE environment_id = ? AND instance_id IS NULL ORDER BY key',
        environmentId,
    ).map(map)
}

/** Instance-scope override rows. */
export function listInstanceScope(instanceId: string): EnvVarRow[] {
    return allRows<Raw>('SELECT * FROM env_var WHERE instance_id = ? ORDER BY key', instanceId).map(map)
}

export function byId(id: string): EnvVarRow | undefined {
    const r = getRow<Raw>('SELECT * FROM env_var WHERE id = ?', id)
    return r ? map(r) : undefined
}

/** Uniqueness lookup within a scope (instance_id NULL for baseline). */
export function byScopeAndKey(
    environmentId: string,
    instanceId: string | null,
    key: string,
): EnvVarRow | undefined {
    const r =
        instanceId === null
            ? getRow<Raw>(
                  'SELECT * FROM env_var WHERE environment_id = ? AND instance_id IS NULL AND key = ?',
                  environmentId,
                  key,
              )
            : getRow<Raw>(
                  'SELECT * FROM env_var WHERE environment_id = ? AND instance_id = ? AND key = ?',
                  environmentId,
                  instanceId,
                  key,
              )
    return r ? map(r) : undefined
}

export function insert(row: EnvVarRow): void {
    prep(
        `INSERT INTO env_var
           (id, project_id, environment_id, instance_id, key, source, value_enc, secret_id, description, required, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        row.id,
        row.projectId,
        row.environmentId,
        row.instanceId ?? null,
        row.key,
        row.source,
        row.valueEnc ?? null,
        row.secretId ?? null,
        row.description ?? null,
        row.required ? 1 : 0,
        row.createdAt,
        row.updatedAt,
    )
}

export function update(
    id: string,
    fields: {
        source?: EnvVarSource
        valueEnc?: string | null
        secretId?: string | null
        description?: string | null
        required?: boolean
        updatedAt: string
    },
): void {
    const sets: string[] = []
    const params: (string | number | null)[] = []
    if (fields.source !== undefined) {
        sets.push('source = ?')
        params.push(fields.source)
    }
    if (fields.valueEnc !== undefined) {
        sets.push('value_enc = ?')
        params.push(fields.valueEnc)
    }
    if (fields.secretId !== undefined) {
        sets.push('secret_id = ?')
        params.push(fields.secretId)
    }
    if (fields.description !== undefined) {
        sets.push('description = ?')
        params.push(fields.description)
    }
    if (fields.required !== undefined) {
        sets.push('required = ?')
        params.push(fields.required ? 1 : 0)
    }
    sets.push('updated_at = ?')
    params.push(fields.updatedAt)
    params.push(id)
    prep(`UPDATE env_var SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function remove(id: string): void {
    prep('DELETE FROM env_var WHERE id = ?').run(id)
}

/** Rows referencing a secret (for the ON DELETE RESTRICT pre-check, planning §4 #18). */
export function listReferencingSecret(secretId: string): EnvVarRow[] {
    return allRows<Raw>('SELECT * FROM env_var WHERE secret_id = ?', secretId).map(map)
}

/** Retarget a row to another scope (bulk move, planning §8.4). */
export function move(
    id: string,
    environmentId: string,
    instanceId: string | null,
    updatedAt: string,
): void {
    prep('UPDATE env_var SET environment_id = ?, instance_id = ?, updated_at = ? WHERE id = ?').run(
        environmentId,
        instanceId,
        updatedAt,
        id,
    )
}
