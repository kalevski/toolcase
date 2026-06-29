// Feature-flags service (planning §4 v6, §9, gap-7). Flags are project-level;
// their VALUE is per environment. developer+ may read/create/edit/toggle.
// Type-validate on write; coerce the stored TEXT → typed form on read (gap-7).

import 'server-only'
import * as flagRepo from '@/server/data/repositories/feature-flag-repo'
import { ID } from '@/server/infrastructure/ids'
import { isValidKey } from '@/server/domain/types'
import type {
    FeatureFlag,
    FeatureFlagValue,
    FlagType,
    FlagWithValues,
} from '@/server/domain/types'

export class FlagExistsError extends Error {}
export class FlagNotFoundError extends Error {}
export class ValueTypeError extends Error {}

const FLAG_TYPES: ReadonlySet<FlagType> = new Set<FlagType>(['boolean', 'string', 'number', 'json'])

function isFlagType(value: unknown): value is FlagType {
    return typeof value === 'string' && (FLAG_TYPES as ReadonlySet<string>).has(value)
}

/**
 * Coerce a stored raw TEXT value into its typed form per the flag's declared
 * type (gap-7). `enabled` drives the boolean type; non-boolean types decode the
 * TEXT column. A null/unparseable value falls back to null.
 */
function coerceValue(type: FlagType, enabled: boolean, raw: string | null): FeatureFlagValue['value'] {
    switch (type) {
        case 'boolean':
            return enabled
        case 'number':
            return raw === null ? null : Number(raw)
        case 'json':
            if (raw === null) return null
            try {
                return JSON.parse(raw)
            } catch {
                return null
            }
        case 'string':
        default:
            return raw
    }
}

/**
 * Validate an incoming value against the flag's type and serialize it to the
 * TEXT form stored in `feature_flag_value.value`. Throws ValueTypeError on a
 * mismatch. Boolean flags carry no value (the `enabled` column is the truth).
 */
function serializeValue(type: FlagType, value: unknown): string | null {
    switch (type) {
        case 'boolean':
            return null
        case 'number': {
            const n = typeof value === 'number' ? value : Number(value)
            if (!Number.isFinite(n)) throw new ValueTypeError('value must be a finite number')
            return String(n)
        }
        case 'json':
            if (typeof value === 'string') {
                try {
                    JSON.parse(value)
                    return value
                } catch {
                    throw new ValueTypeError('value must be valid JSON')
                }
            }
            try {
                return JSON.stringify(value ?? null)
            } catch {
                throw new ValueTypeError('value must be valid JSON')
            }
        case 'string':
        default:
            if (value === null || value === undefined) return ''
            if (typeof value !== 'string') throw new ValueTypeError('value must be a string')
            return value
    }
}

export function listFlagsWithValues(projectId: string): FlagWithValues[] {
    const flags = flagRepo.listFlags(projectId)
    const rows = flagRepo.listValuesByProject(projectId)
    const byFlag = new Map<string, flagRepo.ValueRaw[]>()
    for (const r of rows) {
        const list = byFlag.get(r.flag_id)
        if (list) list.push(r)
        else byFlag.set(r.flag_id, [r])
    }
    return flags.map((flag) => {
        const values: Record<string, FeatureFlagValue> = {}
        for (const r of byFlag.get(flag.id) ?? []) {
            const enabled = r.enabled === 1
            values[r.environment_id] = {
                id: r.id,
                flagId: r.flag_id,
                environmentId: r.environment_id,
                enabled,
                value: coerceValue(flag.type, enabled, r.value),
                updatedAt: r.updated_at,
            }
        }
        return { flag, values }
    })
}

export function createFlag(
    projectId: string,
    fields: { key: string; description?: string; type?: FlagType },
): FeatureFlag {
    const key = (fields.key ?? '').trim()
    if (!isValidKey(key)) throw new ValueTypeError('invalid key')
    if (flagRepo.flagByKey(projectId, key)) throw new FlagExistsError()
    const type = isFlagType(fields.type) ? fields.type : 'boolean'
    const now = new Date().toISOString()
    const flag: FeatureFlag = {
        id: ID.flag(),
        projectId,
        key,
        description: fields.description?.trim() || undefined,
        type,
        createdAt: now,
    }
    flagRepo.insertFlag(flag)
    return flag
}

function requireFlag(projectId: string, flagId: string): FeatureFlag {
    const flag = flagRepo.flagById(flagId)
    if (!flag || flag.projectId !== projectId) throw new FlagNotFoundError()
    return flag
}

export function updateFlag(
    projectId: string,
    flagId: string,
    fields: { description?: string; type?: FlagType },
): FeatureFlag {
    const flag = requireFlag(projectId, flagId)
    const patch: { description?: string; type?: FlagType } = {}
    if (fields.description !== undefined) patch.description = fields.description.trim()
    if (fields.type !== undefined) {
        if (!isFlagType(fields.type)) throw new ValueTypeError('invalid type')
        patch.type = fields.type
    }
    flagRepo.updateFlag(flagId, patch)
    return {
        ...flag,
        description: patch.description !== undefined ? patch.description || undefined : flag.description,
        type: patch.type ?? flag.type,
    }
}

export function deleteFlag(projectId: string, flagId: string): void {
    requireFlag(projectId, flagId)
    flagRepo.removeFlag(flagId)
}

export function setValue(
    projectId: string,
    flagId: string,
    environmentId: string,
    fields: { enabled?: boolean; value?: unknown },
): FeatureFlagValue {
    const flag = requireFlag(projectId, flagId)
    const enabled = Boolean(fields.enabled)
    const raw = serializeValue(flag.type, fields.value)
    const existing = flagRepo.valueRow(flagId, environmentId)
    const now = new Date().toISOString()
    // Capture the id ONCE so the persisted row and the returned object agree on the
    // create path (wharf C2 — the returned `id` was previously hardcoded to '').
    const valueId = existing?.id ?? ID.flagValue()
    flagRepo.upsertValue({
        id: valueId,
        flagId,
        environmentId,
        enabled,
        value: raw,
        updatedAt: now,
    })
    return {
        id: valueId,
        flagId,
        environmentId,
        enabled,
        value: coerceValue(flag.type, enabled, raw),
        updatedAt: now,
    }
}
